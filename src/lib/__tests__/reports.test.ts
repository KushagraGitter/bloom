import {
  blankForm,
  cleanQuestion,
  formFromDraft,
  inListOrder,
  kindOf,
  metaLine,
  newValue,
  parseWeek,
  reportFromForm,
  type Report,
  type ScanDraft,
} from '@/lib/reports';

const DRAFT: ScanDraft = {
  title: 'Complete blood count',
  kind: 'blood',
  report_date: '2026-09-30',
  lab: 'City Lab',
  values: [
    { name: 'Haemoglobin', value: '11.9', unit: 'g/dL', ref_range: '11.5–15.0', flagged_by_lab: false },
    { name: 'Platelets', value: '2.3 lakh/µL', unit: 'lakh/µL', ref_range: '', flagged_by_lab: true },
    { name: 'Blood group', value: 'B+', unit: '', ref_range: '', flagged_by_lab: false },
  ],
  summary: 'A blood count.',
  unreadable_lines: ['Doctor’s signature'],
};

describe('formFromDraft', () => {
  it('fills the form, joining units and working out the week from the report date', () => {
    const form = formFromDraft(DRAFT, 'cbc.jpg', '2026-04-15', '2026-10-03');
    expect(form).toEqual({
      title: 'Complete blood count',
      kind: 'blood',
      week: '24',
      place: 'City Lab',
      date: '2026-09-30',
      values: [
        { name: 'Haemoglobin', value: '11.9 g/dL', range: '11.5–15.0', flagged: false },
        { name: 'Platelets', value: '2.3 lakh/µL', range: '', flagged: true },
        { name: 'Blood group', value: 'B+', range: '', flagged: false },
      ],
      summary: 'A blood count.',
      file: 'cbc.jpg',
      source: 'ai',
      unreadable: ['Doctor’s signature'],
    });
  });

  it('uses this week when the report has no date, or a date in the future', () => {
    expect(formFromDraft({ ...DRAFT, report_date: '' }, 'x', '2026-04-15', '2026-10-03').week).toBe('24');
    expect(formFromDraft({ ...DRAFT, report_date: '2027-01-01' }, 'x', '2026-04-15', '2026-10-03').week).toBe('24');
  });

  it('leaves the week empty when it can’t be worked out', () => {
    expect(formFromDraft(DRAFT, 'x', undefined, '2026-10-03').week).toBe('');
    // A report from before this pregnancy.
    expect(formFromDraft({ ...DRAFT, report_date: '2026-03-01' }, 'x', '2026-04-15', '2026-10-03').week).toBe('');
    // Week 0.
    expect(formFromDraft({ ...DRAFT, report_date: '2026-04-16' }, 'x', '2026-04-15', '2026-10-03').week).toBe('');
  });
});

describe('parseWeek', () => {
  it.each([
    ['', null],
    [' 24 ', 24],
    ['1', 1],
    ['42', 42],
    ['0', undefined],
    ['43', undefined],
    ['2.5', undefined],
    ['abc', undefined],
  ])('%j → %j', (text, week) => expect(parseWeek(text)).toBe(week));
});

describe('reportFromForm', () => {
  const now = new Date('2026-10-03T10:00:00Z');

  it('builds the record to save, dropping half-filled values', () => {
    const form = {
      ...formFromDraft(DRAFT, 'cbc.jpg', '2026-04-15', '2026-10-03'),
      place: '  City Lab ',
      values: [
        { name: ' Haemoglobin ', value: ' 11.9 g/dL ', range: '11.5–15.0', flagged: false },
        { name: 'MCV', value: ' ', range: '', flagged: false },
      ],
    };
    expect(reportFromForm(form, 'me', now)).toEqual({
      title: 'Complete blood count',
      kind: 'blood',
      week: 24,
      place: 'City Lab',
      date: '2026-09-30',
      values: [{ name: 'Haemoglobin', value: '11.9 g/dL', range: '11.5–15.0', flagged: false }],
      summary: 'A blood count.',
      file: 'cbc.jpg',
      source: 'ai',
      added: '2026-10-03T10:00:00.000Z',
      by: 'me',
    });
  });

  it('names the report after its file when no name is typed', () => {
    expect((reportFromForm(blankForm('growth-scan.pdf'), 'me', now) as Report).title).toBe('growth-scan');
  });

  it('says what is missing or wrong', () => {
    expect(reportFromForm(blankForm(), 'me', now)).toBe('title');
    expect(reportFromForm({ ...blankForm(), title: 'TSH', week: '50' }, 'me', now)).toBe('week');
    expect((reportFromForm({ ...blankForm(), title: 'TSH', week: '' }, 'me', now) as Report).week).toBeNull();
  });
});

it('newValue needs both a name and a result, and adds no range of its own', () => {
  expect(newValue(' TSH ', ' 1.8 mIU/L ')).toEqual({ name: 'TSH', value: '1.8 mIU/L', range: '', flagged: false });
  expect(newValue('TSH', ' ')).toBeNull();
  expect(newValue('', '1')).toBeNull();
});

it('metaLine shows the week, place and printed date', () => {
  const date = new Date(2026, 8, 30).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  expect(metaLine({ week: 24, place: 'City Lab', date: '2026-09-30' })).toBe(`Week 24 · City Lab · ${date}`);
  expect(metaLine({ week: null, place: '', date: '' })).toBe('No week');
});

it('inListOrder puts the latest week first, then the newest saved', () => {
  const r = (id: string, week: number | null, added: string) => ({ id, data: { week, added } as Report });
  const sorted = inListOrder([r('a', 12, '2026-10-01'), r('b', 24, '2026-09-01'), r('c', null, '2026-10-03'), r('d', 24, '2026-10-02')]);
  expect(sorted.map((x) => x.id)).toEqual(['d', 'b', 'a', 'c']);
});

it('kindOf falls back to a note', () => {
  expect(kindOf('scan').badge).toBe('SCAN');
  expect(kindOf('x-ray').badge).toBe('NOTE');
});

it('cleanQuestion tidies spaces', () => {
  expect(cleanQuestion('  what   to eat?  ')).toBe('what to eat?');
  expect(cleanQuestion('   ')).toBe('');
});
