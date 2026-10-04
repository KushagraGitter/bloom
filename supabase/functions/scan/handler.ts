/**
 * The `scan` Edge Function's logic, kept free of Deno and SDK imports so the
 * app's Jest suite can test it. `index.ts` wires it to Supabase and Claude.
 *
 * A scan is passed straight through: the phone sends the photo or PDF in the
 * request, this sends it to Claude, and the draft goes back to the phone for
 * review. Nothing about the report is stored or logged here.
 */

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_DAILY_LIMIT = 50;

/** About 10 MB of file, as base64. */
export const MAX_BASE64_LENGTH = 14_000_000;

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const REPORT_KINDS = ['blood', 'scan', 'note'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export type ScanRequest = {
  kind: 'report';
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

/** What Claude read, before anyone has checked it. */
export type ReportDraft = {
  title: string;
  kind: ReportKind;
  report_date: string;
  lab: string;
  values: DraftValue[];
  summary: string;
  unreadable_lines: string[];
};

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
  if (b.kind !== 'report') throw new ScanError('bad_request');
  if (typeof b.pregnancyId !== 'string' || !UUID.test(b.pregnancyId)) throw new ScanError('bad_request');
  if (!file || typeof file !== 'object') throw new ScanError('bad_request');
  if (!MEDIA_TYPES.includes(file.mediaType as MediaType)) throw new ScanError('bad_request');
  if (typeof file.data !== 'string' || file.data.length === 0) throw new ScanError('bad_request');
  if (file.data.length > MAX_BASE64_LENGTH) throw new ScanError('too_large');
  if (!BASE64.test(file.data)) throw new ScanError('bad_request');
  const week = typeof b.week === 'number' && Number.isInteger(b.week) && b.week >= 0 && b.week <= 45 ? b.week : null;
  return { kind: 'report', pregnancyId: b.pregnancyId.toLowerCase(), file: { mediaType: file.mediaType as MediaType, data: file.data }, week };
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

export const SYSTEM_PROMPT = `You read pregnancy health reports (blood tests, ultrasound scans, doctors' notes and prescriptions) from a photo or PDF, for a private app that a pregnant woman and her partner use. What you return is shown to them on a review screen, where they check and correct it before anything is saved.

Rules:
- Copy only what is printed or written. Never guess a value, unit, range, name or date. Leave a field empty rather than guess.
- Copy numbers and units exactly as printed, including local units such as "lakh/µL".
- Put anything important that you cannot read with confidence in unreadable_lines instead of guessing it.
- ref_range is only the range printed on this report. Do not add ranges from your own knowledge.
- flagged_by_lab is true only when the report itself marks the result.
- The summary describes in plain, calm words what kind of report it is and what it lists. You may say which results the report itself marks or prints outside its own ranges. Never diagnose, never say a result is normal or abnormal on your own, never advise on medicines, doses or treatment, and never predict outcomes for her or the baby.
- If the file is not a health report or nothing can be read, return empty fields, no values, and say so in unreadable_lines.`;

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
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema' as const, schema: REPORT_SCHEMA } },
    messages: [
      {
        role: 'user' as const,
        content: [fileBlock, { type: 'text' as const, text: `${context} Read this report.` }],
      },
    ],
  };
}

/** The parts of a Messages API response this reads. */
export type ClaudeResponse = {
  stop_reason: string | null;
  content: { type: string; text?: string }[];
};

const LIMITS = { title: 120, lab: 120, name: 80, value: 60, unit: 30, range: 60, summary: 1500, line: 200, values: 80, lines: 20 };

const clean = (v: unknown, max: number) =>
  (typeof v === 'string' ? v : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Turns Claude's answer into a draft, tidying anything out of shape. */
export function parseClaudeResponse(response: ClaudeResponse): ReportDraft {
  if (response.stop_reason === 'refusal') throw new ScanError('unreadable');
  if (response.stop_reason !== 'end_turn') throw new ScanError('ai_failed');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new ScanError('ai_failed');
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ScanError('ai_failed');
  }
  if (!raw || typeof raw !== 'object') throw new ScanError('ai_failed');
  const values = (Array.isArray(raw.values) ? raw.values : [])
    .map((v: Record<string, unknown>) => ({
      name: clean(v?.name, LIMITS.name),
      value: clean(v?.value, LIMITS.value),
      unit: clean(v?.unit, LIMITS.unit),
      ref_range: clean(v?.ref_range, LIMITS.range),
      flagged_by_lab: v?.flagged_by_lab === true,
    }))
    .filter((v) => v.name && v.value)
    .slice(0, LIMITS.values);
  const date = clean(raw.report_date, 10);
  return {
    title: clean(raw.title, LIMITS.title),
    kind: REPORT_KINDS.includes(raw.kind as ReportKind) ? (raw.kind as ReportKind) : 'note',
    report_date: DATE.test(date) ? date : '',
    lab: clean(raw.lab, LIMITS.lab),
    values,
    summary: clean(raw.summary, LIMITS.summary),
    unreadable_lines: (Array.isArray(raw.unreadable_lines) ? raw.unreadable_lines : [])
      .map((l: unknown) => clean(l, LIMITS.line))
      .filter(Boolean)
      .slice(0, LIMITS.lines),
  };
}

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
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const fail = (code: ScanErrorCode) => json(STATUS[code], { error: code });

/** One scan, start to finish. Errors carry only a code, never report content. */
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
    return fail(e instanceof ScanError ? e.code : 'ai_failed');
  }
  if (!allowed) return fail('daily_limit');

  let response: ClaudeResponse;
  try {
    response = await deps.callClaude(buildClaudeRequest(scan, deps.model));
  } catch {
    return fail('ai_failed');
  }
  try {
    return json(200, { draft: parseClaudeResponse(response) });
  } catch (e) {
    return fail(e instanceof ScanError ? e.code : 'ai_failed');
  }
}
