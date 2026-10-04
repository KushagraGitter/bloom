/**
 * "Download my data": everything Bloom keeps for the pregnancy, as a JSON file
 * (complete, for keeping or moving) and a PDF summary (for reading or showing
 * a doctor). Both are made on the phone from its own copy of the records and
 * handed to the phone's share sheet; nothing is uploaded.
 */
import type { LocalRecord } from '@/lib/vault/localStore';
import { formatCheckin } from '@/lib/readings';
import { moodOf } from '@/lib/mood';
import type { Pregnancy } from '@/lib/data';

/** Bookkeeping records, not her data. */
const SKIP_KINDS = new Set(['meta.copied']);

export type ExportFile = {
  app: 'Bloom';
  version: 1;
  exportedAt: string;
  pregnancy: Pregnancy;
  /** Every record, grouped by its kind. */
  records: Record<string, { id: string; updatedAt: string; data: unknown }[]>;
};

export function exportFile(pregnancy: Pregnancy, records: LocalRecord[], now = new Date()): ExportFile {
  const grouped: ExportFile['records'] = {};
  for (const r of records) {
    if (SKIP_KINDS.has(r.kind) || r.deleted) continue;
    (grouped[r.kind] ??= []).push({ id: r.id, updatedAt: r.updatedAt, data: r.data });
  }
  return { app: 'Bloom', version: 1, exportedAt: now.toISOString(), pregnancy, records: grouped };
}

/** "bloom-data-2026-10-03" */
export const exportName = (day: string) => `bloom-data-${day}`;

// ---------------------------------------------------------------------------
// The PDF summary
// ---------------------------------------------------------------------------

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const day = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
  const [y, m, dd] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const table = (head: string[], rows: string[][]) =>
  rows.length === 0
    ? ''
    : `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;

const section = (title: string, body: string, empty: string) =>
  `<h2>${esc(title)}</h2>${body || `<p class="muted">${esc(empty)}</p>`}`;

const datas = (records: LocalRecord[], kind: string) =>
  records.filter((r) => r.kind === kind && !r.deleted).map((r) => obj(r.data));

const TIME_LABEL: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

/**
 * The summary as a page of HTML for the phone to print to PDF. It lists what
 * was recorded and the lab's own ranges, and never says whether anything is
 * normal.
 */
export function summaryHtml(input: {
  name: string;
  pregnancy: Pregnancy;
  week: number | null;
  records: LocalRecord[];
  today: string;
}): string {
  const { pregnancy: p, records } = input;
  const units = p.units;

  const details: [string, unknown][] = [
    ['Due date', day(p.due_date)],
    ['Week today', input.week ?? ''],
    ['Babies', p.babies],
    ['Blood group', p.blood_group],
    ['Doctor is watching', (p.conditions ?? []).join(', ')],
    ['Allergies', p.allergies],
    ['Doctor / midwife', p.doctor],
    ['Hospital', [p.hospital, p.hospital_phone].filter(Boolean).join(' · ')],
    ['Emergency contact', [p.emergency_contact, p.emergency_phone].filter(Boolean).join(' · ')],
  ];
  const detailRows = details.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, String(v)]);

  const meds = datas(records, 'medication')
    .filter((m) => !str(m.end_date) || str(m.end_date) >= input.today)
    .map((m) => [str(m.name), str(m.dose) || 'As prescribed', TIME_LABEL[str(m.time_of_day)] ?? '', str(m.end_date) ? `until ${day(str(m.end_date))}` : '']);

  const checkins = ['weight', 'bp', 'sugar', 'sleep'].flatMap((type) =>
    datas(records, `reading.${type}`)
      .sort((a, b) => str(b.taken_at).localeCompare(str(a.taken_at)))
      .slice(0, 8)
      .map((r) => {
        const f = formatCheckin(
          { type: type as 'weight', value_num: r.value_num as number | null, value_num2: r.value_num2 as number | null },
          units,
        );
        return [{ weight: 'Weight', bp: 'Blood pressure', sugar: 'Blood sugar', sleep: 'Sleep' }[type]!, `${f.value} ${f.unit}`.trim(), day(str(r.taken_at))];
      }),
  );

  const appts = datas(records, 'appointment')
    .sort((a, b) => str(a.appt_date).localeCompare(str(b.appt_date)))
    .map((a) => [day(str(a.appt_date)), str(a.appt_time).slice(0, 5), str(a.title), str(a.place)]);

  const reports = datas(records, 'report')
    .sort((a, b) => Number(b.week ?? 0) - Number(a.week ?? 0) || str(b.added).localeCompare(str(a.added)))
    .map((r) => {
      const values = (Array.isArray(r.values) ? r.values : []).map(obj);
      const meta = [r.week ? `Week ${r.week}` : '', str(r.place), str(r.date) ? day(str(r.date)) : ''].filter(Boolean).join(' · ');
      return `<div class="report"><h3>${esc(r.title)}</h3><p class="muted">${esc(meta)}</p>${table(
        ['Test', 'Result', 'Lab range', ''],
        values.map((v) => [str(v.name), str(v.value), str(v.range), v.flagged === true ? 'Marked on the report' : '']),
      )}${str(r.summary) ? `<p>${esc(r.summary)}</p><p class="muted">Not a diagnosis. Go over results with your doctor.</p>` : ''}</div>`;
    })
    .join('');

  const questions = datas(records, 'question').map((q) => `<li>${esc(q.text)}</li>`).join('');

  const moods = datas(records, 'mood')
    .sort((a, b) => str(b.at).localeCompare(str(a.at)))
    .slice(0, 14)
    .map((m) => [day(str(m.day)), moodOf(str(m.mood))?.label ?? str(m.mood), (Array.isArray(m.symptoms) ? m.symptoms : []).join(', '), str(m.note)]);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Bloom summary</title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1E1433;margin:32px;font-size:12pt}
h1{font-size:24pt;margin:0 0 4px}h2{font-size:15pt;margin:24px 0 8px;border-bottom:2px solid #1E1433;padding-bottom:4px}
h3{font-size:12pt;margin:12px 0 2px}.muted{color:#5B4F72}table{border-collapse:collapse;width:100%;margin:6px 0}
th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #EFE8FF;vertical-align:top}th{font-size:10pt;color:#5B4F72}
.report{page-break-inside:avoid}footer{margin-top:28px;font-size:10pt;color:#5B4F72}
</style></head><body>
<h1>${esc(input.name || 'Bloom')}</h1>
<p class="muted">Pregnancy summary from Bloom · made ${esc(day(input.today))}</p>
${section('Pregnancy', table(['', ''], detailRows), 'No details yet.')}
${section('Medicines and supplements', table(['Medicine', 'Dose', 'When', ''], meds), 'No medicines.')}
${section('Recent check-ins', table(['', 'Reading', 'Day'], checkins), 'No check-ins yet.')}
${section('Appointments', table(['Day', 'Time', 'What', 'Where'], appts), 'No appointments.')}
${section('Reports', reports, 'No reports.')}
${section('Questions for the doctor', questions ? `<ul>${questions}</ul>` : '', 'No questions.')}
${section('Mood and symptoms (last 14)', table(['Day', 'Mood', 'Symptoms', 'Note'], moods), 'Nothing logged.')}
<footer>Made by Bloom from what you recorded. It doesn&#39;t replace advice from your doctor.</footer>
</body></html>`;
}
