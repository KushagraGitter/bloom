/**
 * Health reports: blood tests, scans and doctors' notes, typed in or read from
 * a photo or PDF by AI and checked on the review sheet. Reports and the
 * questions for the next visit are vault records, so nothing here reaches
 * Supabase in a readable form.
 */

import { gestationalAge } from '@/lib/pregnancy';
import { accents } from '@/theme/tokens';

export const REPORT_KIND = 'report';
export const QUESTION_KIND = 'question';

export type ReportKind = 'blood' | 'scan' | 'note';

/** The type chips on the form, in the design's order. */
export const REPORT_KINDS: { key: ReportKind; label: string; badge: string; tone: string }[] = [
  { key: 'blood', label: 'Blood test', badge: 'BLOOD', tone: accents.orange },
  { key: 'scan', label: 'Scan', badge: 'SCAN', tone: accents.mint },
  { key: 'note', label: 'Doctor note', badge: 'NOTE', tone: accents.pink },
];

export const kindOf = (key: string) => REPORT_KINDS.find((k) => k.key === key) ?? REPORT_KINDS[2];

export const FILTERS: { label: string; kind: ReportKind | null }[] = [
  { label: 'All', kind: null },
  { label: 'Blood', kind: 'blood' },
  { label: 'Scans', kind: 'scan' },
  { label: 'Notes', kind: 'note' },
];

export const TITLE_MAX = 120;
export const PLACE_MAX = 120;
export const NAME_MAX = 80;
export const RESULT_MAX = 60;
export const QUESTION_MAX = 200;

export type ReportValue = {
  name: string;
  /** The result as printed, with its unit, e.g. "11.9 g/dL". */
  value: string;
  /** The range printed on the report, or empty. Never one we made up. */
  range: string;
  /** The report itself marks this result (H, L, *). */
  flagged: boolean;
};

export type Report = {
  title: string;
  kind: ReportKind;
  /** Pregnancy week the report is from, or null when not known. */
  week: number | null;
  /** Lab or clinic. */
  place: string;
  /** Date printed on the report, YYYY-MM-DD, or empty. */
  date: string;
  values: ReportValue[];
  /** The AI's plain-language summary, or empty. */
  summary: string;
  /** Name of the file it was read from, or empty. The file itself is not kept. */
  file: string;
  source: 'ai' | 'manual';
  /** When it was saved, ISO. */
  added: string;
  by: string;
};

export type Question = { text: string; at: string; by: string };

/** What the scan function sends back (see supabase/functions/scan/handler.ts). */
export type ScanDraft = {
  title: string;
  kind: ReportKind;
  report_date: string;
  lab: string;
  values: { name: string; value: string; unit: string; ref_range: string; flagged_by_lab: boolean }[];
  summary: string;
  unreadable_lines: string[];
};

/** The review sheet's fields. */
export type ReportForm = {
  title: string;
  kind: ReportKind;
  week: string;
  place: string;
  date: string;
  values: ReportValue[];
  summary: string;
  file: string;
  source: 'ai' | 'manual';
  unreadable: string[];
};

export const blankForm = (file = ''): ReportForm => ({
  title: '',
  kind: 'blood',
  week: '',
  place: '',
  date: '',
  values: [],
  summary: '',
  file,
  source: 'manual',
  unreadable: [],
});

const join = (value: string, unit: string) => (unit && !value.endsWith(unit) ? `${value} ${unit}` : value);

/**
 * Fills the form from what the AI read. The week is worked out from the date
 * printed on the report when there is one, else it is this week.
 */
export function formFromDraft(draft: ScanDraft, file: string, lmpDate: string | undefined, today: string): ReportForm {
  const day = draft.report_date && draft.report_date <= today ? draft.report_date : today;
  const week = lmpDate && day >= lmpDate ? gestationalAge(lmpDate, day).weeks : null;
  return {
    title: draft.title,
    kind: draft.kind,
    week: week !== null && week >= 1 && week <= 42 ? String(week) : '',
    place: draft.lab,
    date: draft.report_date,
    values: draft.values.map((v) => ({
      name: v.name,
      value: join(v.value, v.unit).slice(0, RESULT_MAX),
      range: v.ref_range,
      flagged: v.flagged_by_lab,
    })),
    summary: draft.summary,
    file,
    source: 'ai',
    unreadable: draft.unreadable_lines,
  };
}

/** A week typed on the form: a whole number from 1 to 42, null when empty, undefined when invalid. */
export function parseWeek(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d{1,2}$/.test(t)) return undefined;
  const n = Number(t);
  return n >= 1 && n <= 42 ? n : undefined;
}

export type FormProblem = 'title' | 'week';

/** What to save, or what is wrong with the form. The title falls back to the file name. */
export function reportFromForm(form: ReportForm, by: string, now: Date = new Date()): Report | FormProblem {
  const title = (form.title.trim() || form.file.replace(/\.[a-z0-9]+$/i, '').trim()).slice(0, TITLE_MAX);
  if (!title) return 'title';
  const week = parseWeek(form.week);
  if (week === undefined) return 'week';
  return {
    title,
    kind: form.kind,
    week,
    place: form.place.trim().slice(0, PLACE_MAX),
    date: form.date,
    values: form.values
      .map((v) => ({ ...v, name: v.name.trim(), value: v.value.trim() }))
      .filter((v) => v.name && v.value),
    summary: form.summary,
    file: form.file,
    source: form.source,
    added: now.toISOString(),
    by,
  };
}

/** A value typed on the form. Typed values have no range: we don't add our own. */
export function newValue(name: string, value: string): ReportValue | null {
  const n = name.trim().slice(0, NAME_MAX);
  const v = value.trim().slice(0, RESULT_MAX);
  return n && v ? { name: n, value: v, range: '', flagged: false } : null;
}

/** "Week 22 · City Lab · 30 Sep 2026", or "No week · …". */
export function metaLine(report: Pick<Report, 'week' | 'place' | 'date'>): string {
  const parts = [report.week ? `Week ${report.week}` : 'No week', report.place];
  if (report.date) {
    const [y, m, d] = report.date.split('-').map(Number);
    parts.push(new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
  }
  return parts.filter(Boolean).join(' · ');
}

/** Newest first: by the week it is from, then by when it was saved. */
export function inListOrder<T extends { data: Report; id: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (b.data.week ?? 0) - (a.data.week ?? 0) || b.data.added.localeCompare(a.data.added) || a.id.localeCompare(b.id),
  );
}

export function cleanQuestion(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, QUESTION_MAX);
}
