/**
 * The `scan` Edge Function's logic, kept free of Deno and SDK imports so the
 * app's Jest suite can test it. `index.ts` wires it to Supabase and Claude.
 *
 * A scan is passed straight through: the phone sends the photo or PDF in the
 * request, this sends it to Claude, and the draft goes back to the phone for
 * review. Three kinds share it: health reports, meal photos and
 * prescriptions. Nothing that was read is stored or logged here.
 */

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_DAILY_LIMIT = 50;

/** About 10 MB of file, as base64. */
export const MAX_BASE64_LENGTH = 14_000_000;

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const REPORT_KINDS = ['blood', 'scan', 'note'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/** What is being read: a health report, a photo of a meal, or a prescription. */
export const SCAN_KINDS = ['report', 'meal', 'rx'] as const;
export type ScanKind = (typeof SCAN_KINDS)[number];

export type ScanRequest = {
  kind: ScanKind;
  pregnancyId: string;
  file: { mediaType: MediaType; data: string };
  /** Her pregnancy week today, so the summary can say how far along she was. */
  week: number | null;
};

export type DraftValue = {
  name: string;
  value: string;
  unit: string;
  ref_range: string;
  flagged_by_lab: boolean;
};

/** What Claude read from a report, before anyone has checked it. */
export type ReportDraft = {
  title: string;
  kind: ReportKind;
  report_date: string;
  lab: string;
  values: DraftValue[];
  summary: string;
  unreadable_lines: string[];
};

export type MealItem = {
  name: string;
  portion: string;
  kcal: number | null;
  protein_g: number | null;
  iron_mg: number | null;
  calcium_mg: number | null;
  folate_mcg: number | null;
  fibre_g: number | null;
};

/** What Claude saw on a plate: estimates, checked on the review sheet. */
export type MealDraft = {
  items: MealItem[];
  confidence: 'high' | 'medium' | 'low';
  unreadable_lines: string[];
};

export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export type RxMed = {
  name: string;
  strength: string;
  dose: string;
  frequency: string;
  time_of_day: TimeOfDay;
  /** Days to take it for, as written, or null when not written. */
  duration_days: number | null;
  instructions: string;
};

/** What Claude read from a prescription, before anyone has checked it. */
export type RxDraft = {
  doctor: string;
  date: string;
  meds: RxMed[];
  unreadable_lines: string[];
};

export type Draft = ReportDraft | MealDraft | RxDraft;

export type ScanErrorCode =
  | 'bad_request'
  | 'too_large'
  | 'not_member'
  | 'daily_limit'
  | 'not_configured'
  | 'unreadable'
  | 'ai_failed';

const STATUS: Record<ScanErrorCode, number> = {
  bad_request: 400,
  too_large: 413,
  not_member: 403,
  daily_limit: 429,
  not_configured: 503,
  unreadable: 422,
  ai_failed: 502,
};

export class ScanError extends Error {
  constructor(public code: ScanErrorCode) {
    super(code);
    this.name = 'ScanError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Checks the body the phone sent. Throws a ScanError when it is not a scan request. */
export function parseScanRequest(body: unknown): ScanRequest {
  if (!body || typeof body !== 'object') throw new ScanError('bad_request');
  const b = body as Record<string, unknown>;
  const file = b.file as Record<string, unknown> | undefined;
  if (!SCAN_KINDS.includes(b.kind as ScanKind)) throw new ScanError('bad_request');
  if (typeof b.pregnancyId !== 'string' || !UUID.test(b.pregnancyId)) throw new ScanError('bad_request');
  if (!file || typeof file !== 'object') throw new ScanError('bad_request');
  if (!MEDIA_TYPES.includes(file.mediaType as MediaType)) throw new ScanError('bad_request');
  // A meal is a photo; only reports and prescriptions come as PDFs.
  if (b.kind === 'meal' && file.mediaType === 'application/pdf') throw new ScanError('bad_request');
  if (typeof file.data !== 'string' || file.data.length === 0) throw new ScanError('bad_request');
  if (file.data.length > MAX_BASE64_LENGTH) throw new ScanError('too_large');
  if (!BASE64.test(file.data)) throw new ScanError('bad_request');
  const week = typeof b.week === 'number' && Number.isInteger(b.week) && b.week >= 0 && b.week <= 45 ? b.week : null;
  return { kind: b.kind as ScanKind, pregnancyId: b.pregnancyId.toLowerCase(), file: { mediaType: file.mediaType as MediaType, data: file.data }, week };
}

/** The JSON shape Claude must answer in (structured outputs). */
export const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'kind', 'report_date', 'lab', 'values', 'summary', 'unreadable_lines'],
  properties: {
    title: { type: 'string', description: 'The report’s own title, e.g. "Complete blood count". Empty if none is printed.' },
    kind: {
      type: 'string',
      enum: [...REPORT_KINDS],
      description: 'blood: lab or blood/urine test. scan: ultrasound or other imaging. note: doctor’s note, prescription or anything else.',
    },
    report_date: { type: 'string', description: 'The date printed on the report as YYYY-MM-DD, or empty.' },
    lab: { type: 'string', description: 'The lab, clinic or hospital name as printed, or empty.' },
    values: {
      type: 'array',
      description: 'Every result printed on the report, in the order printed.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'value', 'unit', 'ref_range', 'flagged_by_lab'],
        properties: {
          name: { type: 'string', description: 'Test or measurement name as printed.' },
          value: { type: 'string', description: 'The result exactly as printed, without the unit.' },
          unit: { type: 'string', description: 'The unit as printed, or empty.' },
          ref_range: { type: 'string', description: 'The reference range printed for this result, or empty.' },
          flagged_by_lab: { type: 'boolean', description: 'True only if the report itself marks this result (H, L, *, bold, "high", "low").' },
        },
      },
    },
    summary: {
      type: 'string',
      description: 'Two to four plain sentences on what the report covers and shows. No diagnosis, no advice.',
    },
    unreadable_lines: {
      type: 'array',
      items: { type: 'string' },
      description: 'Anything that looks important but could not be read with confidence, described briefly.',
    },
  },
} as const;

export const REPORT_PROMPT = `You read pregnancy health reports (blood tests, ultrasound scans, doctors' notes and prescriptions) from a photo or PDF, for a private app that a pregnant woman and her partner use. What you return is shown to them on a review screen, where they check and correct it before anything is saved.

Rules:
- Copy only what is printed or written. Never guess a value, unit, range, name or date. Leave a field empty rather than guess.
- Copy numbers and units exactly as printed, including local units such as "lakh/µL".
- Put anything important that you cannot read with confidence in unreadable_lines instead of guessing it.
- ref_range is only the range printed on this report. Do not add ranges from your own knowledge.
- flagged_by_lab is true only when the report itself marks the result.
- The summary describes in plain, calm words what kind of report it is and what it lists. You may say which results the report itself marks or prints outside its own ranges. Never diagnose, never say a result is normal or abnormal on your own, never advise on medicines, doses or treatment, and never predict outcomes for her or the baby.
- If the file is not a health report or nothing can be read, return empty fields, no values, and say so in unreadable_lines.`;

// Structured outputs take anyOf for "a number or null".
const AMOUNT = (description: string) => ({
  anyOf: [{ type: 'number' }, { type: 'null' }],
  description: `${description} Null if you cannot estimate it.`,
});

export const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'confidence', 'unreadable_lines'],
  properties: {
    items: {
      type: 'array',
      description: 'Each food or drink you can see, one entry each, largest first.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'portion', 'kcal', 'protein_g', 'iron_mg', 'calcium_mg', 'folate_mcg', 'fibre_g'],
        properties: {
          name: { type: 'string', description: 'Plain name of the dish, e.g. "Dal tadka" or "Roti".' },
          portion: { type: 'string', description: 'The amount you can see, e.g. "1 bowl", "2", "½ cup".' },
          kcal: AMOUNT('Estimated calories for this portion.'),
          protein_g: AMOUNT('Estimated protein in grams.'),
          iron_mg: AMOUNT('Estimated iron in milligrams.'),
          calcium_mg: AMOUNT('Estimated calcium in milligrams.'),
          folate_mcg: AMOUNT('Estimated folate in micrograms.'),
          fibre_g: AMOUNT('Estimated fibre in grams.'),
        },
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'How sure you are of the foods and portions overall.' },
    unreadable_lines: {
      type: 'array',
      items: { type: 'string' },
      description: 'Anything on the plate you could not make out, described briefly.',
    },
  },
} as const;

export const MEAL_PROMPT = `You look at a photo of a meal for a private pregnancy app and list what is on the plate, with rough nutrient estimates. A pregnant woman or her partner checks and edits your list on a review screen before anything is saved.

Rules:
- List only foods and drinks you can actually see. Name dishes plainly, in the words a home cook would use; Indian and other regional dishes by their usual names.
- Estimate each portion from what is visible, then estimate its nutrients from typical recipes. These are estimates, so round sensibly (whole calories, one decimal for iron, whole numbers otherwise).
- Use null for a nutrient you cannot reasonably estimate rather than guessing wildly.
- Never comment on whether the food is good or bad for her or the baby, and never give diet advice.
- If the photo is not food or nothing can be made out, return no items and say so in unreadable_lines.`;

export const RX_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['doctor', 'date', 'meds', 'unreadable_lines'],
  properties: {
    doctor: { type: 'string', description: 'The doctor’s name as written, or empty.' },
    date: { type: 'string', description: 'The date on the prescription as YYYY-MM-DD, or empty.' },
    meds: {
      type: 'array',
      description: 'Each medicine, vitamin or supplement prescribed, in the order written. A medicine taken at more than one time of day is listed once per time.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'strength', 'dose', 'frequency', 'time_of_day', 'duration_days', 'instructions'],
        properties: {
          name: { type: 'string', description: 'Medicine name as written, brand or generic.' },
          strength: { type: 'string', description: 'Strength as written, e.g. "500 mg", or empty.' },
          dose: { type: 'string', description: 'How much to take each time, e.g. "1 tablet", as written, or empty.' },
          frequency: { type: 'string', description: 'How often as written, e.g. "1-0-1", "twice daily", "OD", or empty.' },
          time_of_day: {
            type: 'string',
            enum: [...TIMES_OF_DAY],
            description: 'When this entry is taken: morning (breakfast or before noon), afternoon (lunch), evening (dinner or bedtime). Morning if not written.',
          },
          duration_days: {
            anyOf: [{ type: 'integer' }, { type: 'null' }],
            description: 'How many days to take it, if written ("x 1 month" is 30). Null if not written.',
          },
          instructions: { type: 'string', description: 'Other written directions, e.g. "after food", "empty stomach", or empty.' },
        },
      },
    },
    unreadable_lines: {
      type: 'array',
      items: { type: 'string' },
      description: 'Any line that looks like a medicine or direction but could not be read with confidence.',
    },
  },
} as const;

export const RX_PROMPT = `You read a doctor's prescription (often handwritten) from a photo or PDF for a private pregnancy app. What you return is shown on a review screen, where she checks each medicine against the paper before it is added to her list.

Rules:
- Copy medicine names, strengths, doses and directions only as written. Never guess a name or a number; put a line you cannot read with confidence in unreadable_lines instead.
- Read common shorthand: OD/once daily, BD/twice daily, TDS/three times daily, HS/bedtime, 1-0-1 (morning-afternoon-night), AC/before food, PC/after food.
- When a medicine is taken at more than one time of day, list it once for each time, with the same name and dose.
- Never add medicines, doses or advice of your own, never say whether a medicine is safe in pregnancy, and never change what the doctor wrote.
- If the file is not a prescription or nothing can be read, return no medicines and say so in unreadable_lines.`;

/** The schema, system prompt and request line for each kind of scan. */
const KIND = {
  report: { schema: REPORT_SCHEMA, system: REPORT_PROMPT, ask: 'Read this report.' },
  meal: { schema: MEAL_SCHEMA, system: MEAL_PROMPT, ask: 'What is on this plate?' },
  rx: { schema: RX_SCHEMA, system: RX_PROMPT, ask: 'Read this prescription.' },
} as const;

/** The Messages API request for one scan (sent on the beta endpoint for server-side fallbacks). */
export function buildClaudeRequest(scan: ScanRequest, model: string) {
  const fileBlock =
    scan.file.mediaType === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: scan.file.data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: scan.file.mediaType, data: scan.file.data } };
  const context = scan.week === null ? 'Her pregnancy week today is not known.' : `She is in week ${scan.week} of her pregnancy today.`;
  return {
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    system: KIND[scan.kind].system,
    output_config: { format: { type: 'json_schema' as const, schema: KIND[scan.kind].schema } },
    messages: [
      {
        role: 'user' as const,
        content: [fileBlock, { type: 'text' as const, text: `${context} ${KIND[scan.kind].ask}` }],
      },
    ],
  };
}

/** The parts of a Messages API response this reads. */
export type ClaudeResponse = {
  stop_reason: string | null;
  content: { type: string; text?: string }[];
};

const LIMITS = {
  title: 120,
  lab: 120,
  name: 80,
  value: 60,
  unit: 30,
  range: 60,
  summary: 1500,
  line: 200,
  values: 80,
  lines: 20,
  items: 20,
  portion: 40,
  dose: 80,
  meds: 20,
  instructions: 120,
};

const clean = (v: unknown, max: number) =>
  (typeof v === 'string' ? v : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Claude's JSON answer, or the reason there isn't one. */
function answerOf(response: ClaudeResponse): Record<string, unknown> {
  if (response.stop_reason === 'refusal') throw new ScanError('unreadable');
  if (response.stop_reason !== 'end_turn') throw new ScanError('ai_failed');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new ScanError('ai_failed');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ScanError('ai_failed');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ScanError('ai_failed');
  return raw as Record<string, unknown>;
}

const linesOf = (raw: Record<string, unknown>) =>
  (Array.isArray(raw.unreadable_lines) ? raw.unreadable_lines : [])
    .map((l: unknown) => clean(l, LIMITS.line))
    .filter(Boolean)
    .slice(0, LIMITS.lines);

const listOf = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');

const dateOf = (v: unknown) => {
  const date = clean(v, 10);
  return DATE.test(date) ? date : '';
};

/** A nutrient estimate: a sensible non-negative number, or null. */
const amount = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);

/** Turns Claude's answer about a report into a draft, tidying anything out of shape. */
export function parseClaudeResponse(response: ClaudeResponse): ReportDraft {
  const raw = answerOf(response);
  const values = listOf(raw.values)
    .map((v) => ({
      name: clean(v.name, LIMITS.name),
      value: clean(v.value, LIMITS.value),
      unit: clean(v.unit, LIMITS.unit),
      ref_range: clean(v.ref_range, LIMITS.range),
      flagged_by_lab: v.flagged_by_lab === true,
    }))
    .filter((v) => v.name && v.value)
    .slice(0, LIMITS.values);
  return {
    title: clean(raw.title, LIMITS.title),
    kind: REPORT_KINDS.includes(raw.kind as ReportKind) ? (raw.kind as ReportKind) : 'note',
    report_date: dateOf(raw.report_date),
    lab: clean(raw.lab, LIMITS.lab),
    values,
    summary: clean(raw.summary, LIMITS.summary),
    unreadable_lines: linesOf(raw),
  };
}

/** Turns Claude's answer about a plate into a draft. */
export function parseMealResponse(response: ClaudeResponse): MealDraft {
  const raw = answerOf(response);
  const items = listOf(raw.items)
    .map((i) => ({
      name: clean(i.name, LIMITS.name),
      portion: clean(i.portion, LIMITS.portion),
      kcal: amount(i.kcal, 5000),
      protein_g: amount(i.protein_g, 500),
      iron_mg: amount(i.iron_mg, 200),
      calcium_mg: amount(i.calcium_mg, 5000),
      folate_mcg: amount(i.folate_mcg, 5000),
      fibre_g: amount(i.fibre_g, 200),
    }))
    .filter((i) => i.name)
    .slice(0, LIMITS.items);
  const confidence = raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low';
  return { items, confidence, unreadable_lines: linesOf(raw) };
}

/** Turns Claude's answer about a prescription into a draft. */
export function parseRxResponse(response: ClaudeResponse): RxDraft {
  const raw = answerOf(response);
  const meds = listOf(raw.meds)
    .map((m) => {
      const days = m.duration_days;
      return {
        name: clean(m.name, LIMITS.name),
        strength: clean(m.strength, LIMITS.unit),
        dose: clean(m.dose, LIMITS.dose),
        frequency: clean(m.frequency, LIMITS.unit),
        time_of_day: TIMES_OF_DAY.includes(m.time_of_day as TimeOfDay) ? (m.time_of_day as TimeOfDay) : 'morning',
        duration_days: typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= 366 ? days : null,
        instructions: clean(m.instructions, LIMITS.instructions),
      };
    })
    .filter((m) => m.name)
    .slice(0, LIMITS.meds);
  return { doctor: clean(raw.doctor, LIMITS.lab), date: dateOf(raw.date), meds, unreadable_lines: linesOf(raw) };
}

const PARSE: Record<ScanKind, (response: ClaudeResponse) => Draft> = {
  report: parseClaudeResponse,
  meal: parseMealResponse,
  rx: parseRxResponse,
};

export type ScanDeps = {
  /** The signed-in user's token is present (Supabase checks it before the function runs). */
  authorized: boolean;
  /** False when ANTHROPIC_API_KEY is not set. */
  configured: boolean;
  model: string;
  dailyLimit: number;
  /** Calls claim_scan as the signed-in user: true = go ahead, false = allowance used up; throws ScanError('not_member') for non-members. */
  claimScan: (pregnancyId: string, dailyLimit: number) => Promise<boolean>;
  callClaude: (request: ReturnType<typeof buildClaudeRequest>) => Promise<ClaudeResponse>;
  /** Writes one line to the function's logs. Only ever given error details, never report content. */
  log?: (line: string) => void;
};

/** Status, type and message of a failed call, short enough for a log line. API errors carry no report content. */
export function describeError(e: unknown): string {
  if (!e || typeof e !== 'object') return String(e).slice(0, 300);
  const err = e as { status?: unknown; name?: unknown; message?: unknown; error?: { error?: { type?: unknown } } };
  const parts = [
    typeof err.status === 'number' ? String(err.status) : '',
    typeof err.error?.error?.type === 'string' ? err.error.error.type : typeof err.name === 'string' ? err.name : '',
    typeof err.message === 'string' ? err.message : '',
  ];
  return parts.filter(Boolean).join(' ').slice(0, 300);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const fail = (code: ScanErrorCode) => json(STATUS[code], { error: code });

/** One scan, start to finish. Errors carry only a code, never what was read. */
export async function handleScan(req: Request, deps: ScanDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('bad_request');
  if (!deps.authorized) return fail('not_member');
  if (!deps.configured) return fail('not_configured');

  let scan: ScanRequest;
  try {
    scan = parseScanRequest(await req.json());
  } catch (e) {
    return fail(e instanceof ScanError ? e.code : 'bad_request');
  }

  let allowed: boolean;
  try {
    allowed = await deps.claimScan(scan.pregnancyId, deps.dailyLimit);
  } catch (e) {
    if (!(e instanceof ScanError)) deps.log?.(`claim_scan failed: ${describeError(e)}`);
    return fail(e instanceof ScanError ? e.code : 'ai_failed');
  }
  if (!allowed) return fail('daily_limit');

  let response: ClaudeResponse;
  try {
    response = await deps.callClaude(buildClaudeRequest(scan, deps.model));
  } catch (e) {
    deps.log?.(`Claude call failed: ${describeError(e)}`);
    return fail('ai_failed');
  }
  try {
    return json(200, { draft: PARSE[scan.kind](response) });
  } catch (e) {
    deps.log?.(`Claude answer not usable: stop_reason=${response.stop_reason}`);
    return fail(e instanceof ScanError ? e.code : 'ai_failed');
  }
}
