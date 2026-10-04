/** @jest-environment node */
import {
  MAX_BASE64_LENGTH,
  ScanError,
  buildClaudeRequest,
  handleScan,
  parseClaudeResponse,
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
    ['another kind', body({ kind: 'meal' })],
    ['a bad pregnancy id', body({ pregnancyId: 'abc' })],
    ['an unknown file type', body({ file: { mediaType: 'image/gif', data: 'aGVsbG8=' } })],
    ['an empty file', body({ file: { mediaType: 'image/jpeg', data: '' } })],
    ['data that is not base64', body({ file: { mediaType: 'image/jpeg', data: 'not base64!' } })],
    ['no body', null],
  ])('refuses %s', (_, b) => {
    expect(() => parseScanRequest(b)).toThrow(new ScanError('bad_request'));
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
    expect(await run(body({ kind: 'meal' }), d)).toEqual({ status: 400, json: { error: 'bad_request' } });
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

  it('reports a refusal as unreadable', async () => {
    const d = deps({ callClaude: jest.fn(async () => answer(GOOD, 'refusal')) });
    expect(await run(body(), d)).toEqual({ status: 422, json: { error: 'unreadable' } });
  });
});
