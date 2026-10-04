/** @jest-environment node */
import {
  MAX_BASE64_LENGTH,
  MEAL_SCHEMA,
  REPORT_SCHEMA,
  RX_SCHEMA,
  ScanError,
  buildClaudeRequest,
  handleScan,
  parseClaudeResponse,
  parseMealResponse,
  parseRxResponse,
  parseScanRequest,
  type ClaudeResponse,
  type ScanDeps,
} from '../handler';

const PID = '3f0c9a52-1d7e-4b8a-9c11-2b3c4d5e6f70';
const body = (over: Record<string, unknown> = {}) => ({
  kind: 'report',
  pregnancyId: PID,
  file: { mediaType: 'image/jpeg', data: 'aGVsbG8=' },
  week: 24,
  ...over,
});

const answer = (draft: unknown, stop_reason = 'end_turn'): ClaudeResponse => ({
  stop_reason,
  content: [
    { type: 'thinking', text: undefined },
    { type: 'text', text: JSON.stringify(draft) },
  ],
});

const GOOD = {
  title: ' Complete  blood count ',
  kind: 'blood',
  report_date: '2026-09-30',
  lab: 'City Lab',
  values: [
    { name: 'Haemoglobin', value: '11.9', unit: 'g/dL', ref_range: '11.5–15.0', flagged_by_lab: false },
    { name: 'Platelets', value: '2.3', unit: 'lakh/µL', ref_range: '1.5–4.5', flagged_by_lab: true },
  ],
  summary: 'A blood count with four results.',
  unreadable_lines: [],
};

function deps(over: Partial<ScanDeps> = {}): ScanDeps {
  return {
    authorized: true,
    configured: true,
    model: 'test-model',
    dailyLimit: 50,
    claimScan: jest.fn(async () => true),
    callClaude: jest.fn(async () => answer(GOOD)),
    ...over,
  };
}

const post = (payload: unknown) =>
  new Request('https://x.supabase.co/functions/v1/scan', { method: 'POST', body: JSON.stringify(payload) });

async function run(payload: unknown, d: ScanDeps) {
  const res = await handleScan(post(payload), d);
  return { status: res.status, json: await res.json() };
}

describe('parseScanRequest', () => {
  it('accepts a photo or a PDF', () => {
    expect(parseScanRequest(body())).toEqual(body());
    expect(parseScanRequest(body({ file: { mediaType: 'application/pdf', data: 'JVBERi0=' } })).file.mediaType).toBe('application/pdf');
  });

  it.each([
    ['another kind', body({ kind: 'pills' })],
    ['a meal sent as a PDF', body({ kind: 'meal', file: { mediaType: 'application/pdf', data: 'JVBERi0=' } })],
    ['a bad pregnancy id', body({ pregnancyId: 'abc' })],
    ['an unknown file type', body({ file: { mediaType: 'image/gif', data: 'aGVsbG8=' } })],
    ['an empty file', body({ file: { mediaType: 'image/jpeg', data: '' } })],
    ['data that is not base64', body({ file: { mediaType: 'image/jpeg', data: 'not base64!' } })],
    ['no body', null],
  ])('refuses %s', (_, b) => {
    expect(() => parseScanRequest(b)).toThrow(new ScanError('bad_request'));
  });

  it('accepts a meal photo and a prescription', () => {
    expect(parseScanRequest(body({ kind: 'meal' })).kind).toBe('meal');
    expect(parseScanRequest(body({ kind: 'rx', file: { mediaType: 'application/pdf', data: 'JVBERi0=' } })).kind).toBe('rx');
  });

  it('refuses a file over the size limit', () => {
    const data = 'A'.repeat(MAX_BASE64_LENGTH + 4);
    expect(() => parseScanRequest(body({ file: { mediaType: 'image/jpeg', data } }))).toThrow(new ScanError('too_large'));
  });

  it('drops a week that is not a whole pregnancy week', () => {
    expect(parseScanRequest(body({ week: 24.5 })).week).toBeNull();
    expect(parseScanRequest(body({ week: 60 })).week).toBeNull();
    expect(parseScanRequest(body({ week: '24' })).week).toBeNull();
  });
});

describe('buildClaudeRequest', () => {
  it('sends a photo as an image block with the week as context', () => {
    const r = buildClaudeRequest(parseScanRequest(body()), 'm');
    expect(r.model).toBe('m');
    expect(r.output_config.format.type).toBe('json_schema');
    expect(r.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } });
    expect(r.messages[0].content[1]).toEqual({ type: 'text', text: 'She is in week 24 of her pregnancy today. Read this report.' });
  });

  it('sends a PDF as a document block', () => {
    const r = buildClaudeRequest(parseScanRequest(body({ file: { mediaType: 'application/pdf', data: 'JVBERi0=' }, week: null })), 'm');
    expect(r.messages[0].content[0]).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } });
    expect(r.messages[0].content[1]).toEqual({ type: 'text', text: 'Her pregnancy week today is not known. Read this report.' });
  });
});

describe('buildClaudeRequest for each kind', () => {
  it.each([
    ['report', REPORT_SCHEMA, 'Read this report.', 'health reports'],
    ['meal', MEAL_SCHEMA, 'What is on this plate?', 'photo of a meal'],
    ['rx', RX_SCHEMA, 'Read this prescription.', 'prescription'],
  ])('asks about a %s with its own schema and prompt', (kind, schema, ask, words) => {
    const r = buildClaudeRequest(parseScanRequest(body({ kind })), 'm');
    expect(r.output_config.format.schema).toBe(schema);
    expect(r.system).toContain(words);
    expect(r.messages[0].content[1]).toEqual({ type: 'text', text: `She is in week 24 of her pregnancy today. ${ask}` });
  });
});

describe('parseMealResponse', () => {
  it('keeps each named item with sensible estimates, and nulls the rest', () => {
    const draft = parseMealResponse(
      answer({
        items: [
          { name: ' Dal  tadka ', portion: '1 bowl', kcal: 180, protein_g: 9, iron_mg: 2.1, calcium_mg: 40, folate_mcg: 90, fibre_g: 4 },
          { name: 'Roti', portion: '2', kcal: -5, protein_g: 'lots', iron_mg: null, calcium_mg: 1e9, folate_mcg: 30, fibre_g: 3 },
          { name: '', portion: '1', kcal: 10 },
          'rice',
        ],
        confidence: 'very',
        unreadable_lines: ['Something under the foil'],
      }),
    );
    expect(draft.items).toEqual([
      { name: 'Dal tadka', portion: '1 bowl', kcal: 180, protein_g: 9, iron_mg: 2.1, calcium_mg: 40, folate_mcg: 90, fibre_g: 4 },
      { name: 'Roti', portion: '2', kcal: null, protein_g: null, iron_mg: null, calcium_mg: null, folate_mcg: 30, fibre_g: 3 },
    ]);
    expect(draft.confidence).toBe('low');
    expect(draft.unreadable_lines).toEqual(['Something under the foil']);
  });

  it('keeps a high or medium confidence', () => {
    expect(parseMealResponse(answer({ items: [], confidence: 'high', unreadable_lines: [] })).confidence).toBe('high');
    expect(parseMealResponse(answer({ items: [], confidence: 'medium', unreadable_lines: [] })).confidence).toBe('medium');
  });

  it('fails like a report does', () => {
    expect(() => parseMealResponse(answer({}, 'refusal'))).toThrow(new ScanError('unreadable'));
    expect(() => parseMealResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: '[]' }] })).toThrow(new ScanError('ai_failed'));
  });
});

describe('parseRxResponse', () => {
  it('keeps each medicine, fixing an odd time, duration or date', () => {
    const draft = parseRxResponse(
      answer({
        doctor: 'Dr  Rao',
        date: '2026-09-28',
        meds: [
          {
            name: 'Ferrous ascorbate',
            strength: '100 mg',
            dose: '1 tablet',
            frequency: 'OD',
            time_of_day: 'afternoon',
            duration_days: 90,
            instructions: 'after food',
          },
          { name: 'Calcium', strength: '', dose: '1 tab', frequency: 'HS', time_of_day: 'night', duration_days: 2.5, instructions: '' },
          { name: '', dose: '1' },
        ],
        unreadable_lines: ['Line 4'],
      }),
    );
    expect(draft.doctor).toBe('Dr Rao');
    expect(draft.date).toBe('2026-09-28');
    expect(draft.meds).toEqual([
      {
        name: 'Ferrous ascorbate',
        strength: '100 mg',
        dose: '1 tablet',
        frequency: 'OD',
        time_of_day: 'afternoon',
        duration_days: 90,
        instructions: 'after food',
      },
      { name: 'Calcium', strength: '', dose: '1 tab', frequency: 'HS', time_of_day: 'morning', duration_days: null, instructions: '' },
    ]);
    expect(draft.unreadable_lines).toEqual(['Line 4']);
    expect(parseRxResponse(answer({ doctor: '', date: 'Monday', meds: [], unreadable_lines: [] })).date).toBe('');
  });
});

describe('parseClaudeResponse', () => {
  it('tidies the draft', () => {
    const draft = parseClaudeResponse(answer(GOOD));
    expect(draft.title).toBe('Complete blood count');
    expect(draft.values).toHaveLength(2);
    expect(draft.values[1]).toEqual({ name: 'Platelets', value: '2.3', unit: 'lakh/µL', ref_range: '1.5–4.5', flagged_by_lab: true });
  });

  it('drops values without a name or a result, and fixes an odd kind and date', () => {
    const draft = parseClaudeResponse(
      answer({
        ...GOOD,
        kind: 'x-ray',
        report_date: '30/09/2026',
        values: [{ name: 'TSH', value: '' }, { name: '', value: '1' }, { name: 'TSH', value: '1.8', flagged_by_lab: 'yes' }],
        unreadable_lines: ['', 'Signature', 5],
      }),
    );
    expect(draft.kind).toBe('note');
    expect(draft.report_date).toBe('');
    expect(draft.values).toEqual([{ name: 'TSH', value: '1.8', unit: '', ref_range: '', flagged_by_lab: false }]);
    expect(draft.unreadable_lines).toEqual(['Signature']);
  });

  it('treats a refusal as unreadable and anything cut short or malformed as a failure', () => {
    expect(() => parseClaudeResponse(answer(GOOD, 'refusal'))).toThrow(new ScanError('unreadable'));
    expect(() => parseClaudeResponse(answer(GOOD, 'max_tokens'))).toThrow(new ScanError('ai_failed'));
    expect(() => parseClaudeResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{oops' }] })).toThrow(
      new ScanError('ai_failed'),
    );
    expect(() => parseClaudeResponse({ stop_reason: 'end_turn', content: [] })).toThrow(new ScanError('ai_failed'));
  });
});

describe('handleScan', () => {
  it('reads each kind with its own parser', async () => {
    const meal = deps({
      callClaude: jest.fn(async () => answer({ items: [{ name: 'Idli', portion: '3', kcal: 120 }], confidence: 'high', unreadable_lines: [] })),
    });
    const { status, json } = await run(body({ kind: 'meal' }), meal);
    expect(status).toBe(200);
    expect(json.draft.items[0]).toMatchObject({ name: 'Idli', kcal: 120, protein_g: null });

    const rx = deps({ callClaude: jest.fn(async () => answer({ doctor: 'Dr Rao', date: '', meds: [], unreadable_lines: [] })) });
    expect((await run(body({ kind: 'rx' }), rx)).json.draft).toEqual({ doctor: 'Dr Rao', date: '', meds: [], unreadable_lines: [] });
  });

  it('claims a scan, asks Claude and returns the draft', async () => {
    const d = deps();
    const { status, json } = await run(body(), d);
    expect(status).toBe(200);
    expect(json.draft.title).toBe('Complete blood count');
    expect(d.claimScan).toHaveBeenCalledWith(PID, 50);
    expect(d.callClaude).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model' }));
  });

  it('answers the browser preflight', async () => {
    const res = await handleScan(new Request('https://x', { method: 'OPTIONS' }), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
  });

  it('turns away a request without a signed-in user before reading it', async () => {
    const d = deps({ authorized: false });
    expect(await run(body(), d)).toEqual({ status: 403, json: { error: 'not_member' } });
    expect(d.claimScan).not.toHaveBeenCalled();
  });

  it('says when the API key is not set up, without spending a scan', async () => {
    const d = deps({ configured: false });
    expect(await run(body(), d)).toEqual({ status: 503, json: { error: 'not_configured' } });
    expect(d.claimScan).not.toHaveBeenCalled();
  });

  it('refuses a bad request without spending a scan', async () => {
    const d = deps();
    expect(await run(body({ kind: 'pills' }), d)).toEqual({ status: 400, json: { error: 'bad_request' } });
    expect(d.claimScan).not.toHaveBeenCalled();
  });

  it('stops at the daily limit without calling Claude', async () => {
    const d = deps({ claimScan: jest.fn(async () => false) });
    expect(await run(body(), d)).toEqual({ status: 429, json: { error: 'daily_limit' } });
    expect(d.callClaude).not.toHaveBeenCalled();
  });

  it('refuses someone outside the household without calling Claude', async () => {
    const d = deps({
      claimScan: jest.fn(async () => {
        throw new ScanError('not_member');
      }),
    });
    expect(await run(body(), d)).toEqual({ status: 403, json: { error: 'not_member' } });
    expect(d.callClaude).not.toHaveBeenCalled();
  });

  it('reports a database or API failure as a failed scan', async () => {
    const dbDown = deps({
      claimScan: jest.fn(async () => {
        throw new Error('down');
      }),
    });
    expect(await run(body(), dbDown)).toEqual({ status: 502, json: { error: 'ai_failed' } });
    const apiDown = deps({
      callClaude: jest.fn(async () => {
        throw new Error('overloaded');
      }),
    });
    expect(await run(body(), apiDown)).toEqual({ status: 502, json: { error: 'ai_failed' } });
  });

  it('logs why a scan failed, without the report', async () => {
    const log = jest.fn();
    const apiError = Object.assign(new Error('Your credit balance is too low'), {
      status: 400,
      error: { type: 'error', error: { type: 'invalid_request_error' } },
    });
    const d = deps({ log, callClaude: jest.fn(async () => Promise.reject(apiError)) });
    expect(await run(body(), d)).toEqual({ status: 502, json: { error: 'ai_failed' } });
    expect(log).toHaveBeenCalledWith('Claude call failed: 400 invalid_request_error Your credit balance is too low');
    expect(log.mock.calls.flat().join(' ')).not.toContain(body().file.data);

    const cut = deps({ log, callClaude: jest.fn(async () => answer(GOOD, 'max_tokens')) });
    expect(await run(body(), cut)).toEqual({ status: 502, json: { error: 'ai_failed' } });
    expect(log).toHaveBeenLastCalledWith('Claude answer not usable: stop_reason=max_tokens');

    const dbDown = deps({ log, claimScan: jest.fn(async () => Promise.reject(new TypeError('fetch failed'))) });
    await run(body(), dbDown);
    expect(log).toHaveBeenLastCalledWith('claim_scan failed: TypeError fetch failed');
  });

  it('reports a refusal as unreadable', async () => {
    const d = deps({ callClaude: jest.fn(async () => answer(GOOD, 'refusal')) });
    expect(await run(body(), d)).toEqual({ status: 422, json: { error: 'unreadable' } });
  });
});
