import type { Pregnancy } from '@/lib/data';
import { exportFile, exportName, summaryHtml } from '@/lib/exportData';
import type { LocalRecord } from '@/lib/vault/localStore';

const pregnancy = {
  id: 'p1',
  owner_id: 'me',
  lmp_date: '2026-04-15',
  due_date: '2027-01-20',
  method: 'lmp',
  babies: 1,
  first_pregnancy: true,
  sex: 'unknown',
  nickname: null,
  height_cm: 162,
  pre_weight_kg: 59,
  blood_group: 'B+',
  conditions: ['Thyroid'],
  allergies: 'Penicillin',
  doctor: 'Dr Mehta',
  hospital: null,
  hospital_phone: null,
  emergency_contact: null,
  emergency_phone: null,
  units: 'metric',
} as unknown as Pregnancy;

const rec = (id: string, kind: string, data: unknown, deleted = false): LocalRecord => ({
  id,
  pregnancyId: 'p1',
  kind,
  data,
  updatedAt: '2026-10-01T10:00:00.000Z',
  deleted,
  dirty: false,
});

describe('exportFile', () => {
  it('groups every live record by kind and leaves out bookkeeping', () => {
    const file = exportFile(
      pregnancy,
      [
        rec('m1', 'medication', { name: 'Folic acid' }),
        rec('w1', 'reading.weight', { value_num: 62 }),
        rec('w2', 'reading.weight', { value_num: 63 }),
        rec('c1', 'meta.copied', { at: 'x' }),
        rec('gone', 'medication', null, true),
      ],
      new Date('2026-10-04T08:00:00.000Z'),
    );
    expect(file).toMatchObject({ app: 'Bloom', version: 1, exportedAt: '2026-10-04T08:00:00.000Z', pregnancy: { id: 'p1' } });
    expect(Object.keys(file.records).sort()).toEqual(['medication', 'reading.weight']);
    expect(file.records.medication).toEqual([{ id: 'm1', updatedAt: '2026-10-01T10:00:00.000Z', data: { name: 'Folic acid' } }]);
    expect(file.records['reading.weight']).toHaveLength(2);
  });

  it('names the file by the day', () => {
    expect(exportName('2026-10-04')).toBe('bloom-data-2026-10-04');
  });
});

describe('summaryHtml', () => {
  const html = (records: LocalRecord[]) => summaryHtml({ name: 'Ananya <Rao>', pregnancy, week: 24, records, today: '2026-10-04' });

  it('lists details, current medicines, check-ins, reports, questions and moods', () => {
    const out = html([
      rec('m1', 'medication', { name: 'Folic acid', dose: '5 mg', time_of_day: 'morning' }),
      rec('m2', 'medication', { name: 'Old course', dose: '1 tab', time_of_day: 'evening', end_date: '2026-09-01' }),
      rec('w1', 'reading.weight', { value_num: 62.4, taken_at: '2026-10-03T08:00:00.000Z' }),
      rec('a1', 'appointment', { appt_date: '2026-10-10', appt_time: '10:30:00', title: 'Anomaly scan', place: 'City Hospital' }),
      rec('r1', 'report', {
        title: 'Blood test',
        week: 22,
        values: [
          { name: 'Haemoglobin', value: '10.2 g/dL', range: '11–15', flagged: true },
          { name: 'TSH', value: '2.1', range: '0.5–4.5', flagged: false },
        ],
        summary: 'Haemoglobin is below the lab range.',
      }),
      rec('q1', 'question', { text: 'Should I take iron?' }),
      rec('mo1', 'mood', { day: '2026-10-03', at: '2026-10-03T09:00:00.000Z', mood: 'good', symptoms: ['Nausea'] }),
    ]);
    expect(out).toContain('Ananya &lt;Rao&gt;');
    expect(out).toContain('Penicillin');
    expect(out).toContain('Thyroid');
    expect(out).toContain('Folic acid');
    expect(out).not.toContain('Old course');
    expect(out).toContain('62.4');
    expect(out).toContain('Anomaly scan');
    expect(out).toContain('10:30');
    expect(out).toContain('Haemoglobin');
    expect(out).toContain('Marked on the report');
    expect(out).toContain('Not a diagnosis');
    expect(out).toContain('Should I take iron?');
    expect(out).toContain('Good');
    expect(out).toContain('Nausea');
  });

  it('escapes what she typed', () => {
    const out = html([rec('q1', 'question', { text: '<script>alert(1)</script>' })]);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('says what is empty and never judges a result', () => {
    const out = html([]);
    expect(out).toContain('No medicines.');
    expect(out).toContain('No reports.');
    expect(out).not.toMatch(/\b(ab)?normal\b/i);
  });
});
