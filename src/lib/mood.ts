/**
 * Mood and symptoms: the choices on the screen, and how a saved entry reads
 * back in the history. Entries and her own symptoms are vault records.
 */

import { addDays, localToday } from '@/lib/pregnancy';
import { accents } from '@/theme/tokens';

export const ENTRY_KIND = 'mood';
export const SYMPTOM_KIND = 'symptom';

export type MoodKey = 'great' | 'good' | 'okay' | 'low' | 'rough';

/** The five faces, best first, with the design's fills and mouths. */
export const MOODS: { key: MoodKey; label: string; tone: string; mouth: string }[] = [
  { key: 'great', label: 'Great', tone: accents.mint, mouth: 'M7.5 14c1.2 2.5 2.8 3.5 4.5 3.5s3.3-1 4.5-3.5' },
  { key: 'good', label: 'Good', tone: accents.mintSoft, mouth: 'M8.5 15c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8' },
  { key: 'okay', label: 'Okay', tone: accents.yellow, mouth: 'M8.5 15.5h7' },
  { key: 'low', label: 'Low', tone: accents.pink, mouth: 'M8.5 16.5c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8' },
  { key: 'rough', label: 'Rough', tone: accents.orange, mouth: 'M7.5 17.5c1.2-2.5 2.8-3.5 4.5-3.5s3.3 1 4.5 3.5' },
];

export const moodOf = (key: string) => MOODS.find((m) => m.key === key);

/** The design's list. Her own additions come after these. */
export const SYMPTOMS = [
  'Nausea',
  'Back pain',
  'Swelling',
  'Heartburn',
  'Headache',
  'Cramps',
  'Tired',
  'Can’t sleep',
  'Leg cramps',
  'Dizzy',
];

export const SYMPTOM_MAX = 40;
export const NOTE_MAX = 500;

export type MoodEntry = {
  /** Local day it was saved, YYYY-MM-DD. */
  day: string;
  /** When it was saved, ISO. */
  at: string;
  mood: MoodKey;
  symptoms: string[];
  note: string;
  by: string;
};

export type CustomSymptom = { label: string };

const fold = (s: string) => s.trim().toLocaleLowerCase();

/** Tidies a typed symptom: trimmed, single spaces, first letter capital. Empty when there is nothing. */
export function cleanSymptom(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ').slice(0, SYMPTOM_MAX).trim();
  return t ? t[0].toLocaleUpperCase() + t.slice(1) : '';
}

/**
 * The chips to show: the design's list, then her own in the order added,
 * leaving out any that match one already shown (ignoring case), and then any
 * still ticked on the form that are no longer on either list.
 */
export function symptomList(custom: string[], picked: string[] = []): string[] {
  const seen = new Set(SYMPTOMS.map(fold));
  const out = [...SYMPTOMS];
  for (const label of [...custom, ...picked]) {
    if (seen.has(fold(label))) continue;
    seen.add(fold(label));
    out.push(label);
  }
  return out;
}

export const isBuiltIn = (label: string) => SYMPTOMS.some((s) => fold(s) === fold(label));

/** The ticked symptoms in the order the chips show them. */
export function inListOrder(picked: string[], list: string[]): string[] {
  const set = new Set(picked);
  return list.filter((l) => set.has(l));
}

export function symptomsLine(symptoms: string[]): string {
  return symptoms.length ? symptoms.join(' · ') : 'No symptoms';
}

/** "Today, 8:10 am", "Yesterday, 9:30 pm", or "Thu, 1 Oct". */
export function whenLabel(entry: Pick<MoodEntry, 'day' | 'at'>, today: string = localToday()): string {
  const time = new Date(entry.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (entry.day === today) return `Today, ${time}`;
  if (entry.day === addDays(today, -1)) return `Yesterday, ${time}`;
  const [y, m, d] = entry.day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Newest first. */
export function newestFirst<T extends { at: string; id: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}
