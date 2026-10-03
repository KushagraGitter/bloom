/**
 * The Profile screen's editable rows: how each pregnancy column is shown,
 * prefilled into the edit sheet, and turned back into an update.
 */
import { BABY_OPTIONS, BLOOD_GROUPS, CONDITIONS, datingFor } from '@/lib/onboarding';
import type { Units } from '@/lib/readings';

export type PregnancyRow = {
  id: string;
  owner_id: string;
  lmp_date: string;
  due_date: string;
  method: 'lmp' | 'due' | 'ivf';
  babies: number;
  first_pregnancy: boolean | null;
  sex: 'girl' | 'boy' | 'unknown' | null;
  nickname: string | null;
  height_cm: number | null;
  pre_weight_kg: number | null;
  blood_group: string | null;
  conditions: string[];
  allergies: string | null;
  doctor: string | null;
  hospital: string | null;
  hospital_phone: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  units: Units;
};

export type FieldKey =
  | 'lmp_date'
  | 'babies'
  | 'first_pregnancy'
  | 'sex'
  | 'nickname'
  | 'height_cm'
  | 'pre_weight_kg'
  | 'blood_group'
  | 'conditions'
  | 'allergies'
  | 'doctor'
  | 'hospital'
  | 'hospital_phone'
  | 'emergency_contact'
  | 'emergency_phone';

export type FieldKind = 'text' | 'tel' | 'number' | 'date' | 'choice' | 'multi';

export type Field = {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
};

const FIRST = ['Yes', 'No'] as const;
const SEX = ['Girl', 'Boy', 'Surprise'] as const;
const LB_PER_KG = 2.20462;

export function fieldsFor(units: Units): Record<FieldKey, Field> {
  return {
    lmp_date: { key: 'lmp_date', label: 'Last period started', kind: 'date', hint: 'Your week and due date update from this.' },
    babies: { key: 'babies', label: 'Babies', kind: 'choice', options: BABY_OPTIONS },
    first_pregnancy: { key: 'first_pregnancy', label: 'First pregnancy', kind: 'choice', options: FIRST },
    sex: { key: 'sex', label: 'Baby’s sex', kind: 'choice', options: SEX },
    nickname: { key: 'nickname', label: 'Nickname', kind: 'text', placeholder: 'e.g. Peanut' },
    height_cm: { key: 'height_cm', label: 'Height', kind: 'number', placeholder: 'cm', hint: 'Enter in cm.' },
    pre_weight_kg: {
      key: 'pre_weight_kg',
      label: 'Weight before pregnancy',
      kind: 'number',
      placeholder: units === 'imperial' ? 'lb' : 'kg',
      hint: units === 'imperial' ? 'Enter in lb.' : 'Enter in kg.',
    },
    blood_group: { key: 'blood_group', label: 'Blood group', kind: 'choice', options: BLOOD_GROUPS },
    conditions: { key: 'conditions', label: 'Doctor is watching', kind: 'multi', options: CONDITIONS },
    allergies: { key: 'allergies', label: 'Allergies', kind: 'text', placeholder: 'e.g. Penicillin' },
    doctor: { key: 'doctor', label: 'Doctor / midwife', kind: 'text' },
    hospital: { key: 'hospital', label: 'Hospital', kind: 'text' },
    hospital_phone: { key: 'hospital_phone', label: 'Hospital phone', kind: 'tel', placeholder: '+91 …' },
    emergency_contact: { key: 'emergency_contact', label: 'Emergency contact', kind: 'text' },
    emergency_phone: { key: 'emergency_phone', label: 'Their phone', kind: 'tel', placeholder: '+91 …' },
  };
}

export const GROUPS: { title: string; keys: FieldKey[] }[] = [
  { title: 'PREGNANCY', keys: ['lmp_date', 'babies', 'first_pregnancy', 'sex', 'nickname'] },
  { title: 'HEALTH', keys: ['height_cm', 'pre_weight_kg', 'blood_group', 'conditions', 'allergies'] },
  { title: 'CARE TEAM', keys: ['doctor', 'hospital', 'hospital_phone', 'emergency_contact', 'emergency_phone'] },
];

export function formatDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The sheet's starting value: a string for inputs and choices, a list for conditions. */
export function draftFor(p: PregnancyRow, key: FieldKey): string | string[] {
  switch (key) {
    case 'lmp_date':
      return p.lmp_date;
    case 'babies':
      return BABY_OPTIONS[Math.min(p.babies, 3) - 1];
    case 'first_pregnancy':
      return p.first_pregnancy === null ? '' : p.first_pregnancy ? 'Yes' : 'No';
    case 'sex':
      return p.sex === 'girl' ? 'Girl' : p.sex === 'boy' ? 'Boy' : 'Surprise';
    case 'height_cm':
      return p.height_cm === null ? '' : String(Number(p.height_cm));
    case 'pre_weight_kg':
      if (p.pre_weight_kg === null) return '';
      return String(p.units === 'imperial' ? round1(Number(p.pre_weight_kg) * LB_PER_KG) : Number(p.pre_weight_kg));
    case 'blood_group':
      return p.blood_group ? p.blood_group.replace('-', '−') : '';
    case 'conditions':
      return p.conditions;
    default:
      return p[key] ?? '';
  }
}

/** What the row shows on the right, or '' for "Add". */
export function displayFor(p: PregnancyRow, key: FieldKey): string {
  switch (key) {
    case 'lmp_date':
      return formatDate(p.lmp_date);
    case 'height_cm':
      return p.height_cm === null ? '' : `${Number(p.height_cm)} cm`;
    case 'pre_weight_kg':
      return p.pre_weight_kg === null ? '' : `${draftFor(p, key)} ${p.units === 'imperial' ? 'lb' : 'kg'}`;
    case 'conditions':
      return p.conditions.length ? p.conditions.join(', ') : '';
    default: {
      const d = draftFor(p, key);
      return typeof d === 'string' ? d : '';
    }
  }
}

export type Patch = { ok: true; patch: Record<string, unknown> } | { ok: false; error: string };

const text = (s: string) => (s.trim() ? s.trim() : null);

/** Turns the sheet's value into a `pregnancies` update, or an error to show. */
export function patchFor(p: PregnancyRow, key: FieldKey, draft: string | string[], today: string): Patch {
  const s = typeof draft === 'string' ? draft : '';
  switch (key) {
    case 'lmp_date': {
      const dating = datingFor({ method: 'lmp', date: s, embryoDay: 5 }, today);
      if (!dating.ok) return { ok: false, error: 'Pick a date in the last 42 weeks.' };
      // Editing the date directly makes it the source of truth from now on.
      return { ok: true, patch: { lmp_date: s, method: 'lmp', ivf_transfer_date: null, ivf_embryo_day: null } };
    }
    case 'babies': {
      const i = BABY_OPTIONS.indexOf(s as (typeof BABY_OPTIONS)[number]);
      return i === -1 ? { ok: false, error: 'Pick one.' } : { ok: true, patch: { babies: i + 1 } };
    }
    case 'first_pregnancy':
      return { ok: true, patch: { first_pregnancy: s === '' ? null : s === 'Yes' } };
    case 'sex':
      return { ok: true, patch: { sex: s === 'Girl' ? 'girl' : s === 'Boy' ? 'boy' : 'unknown' } };
    case 'height_cm': {
      if (!s.trim()) return { ok: true, patch: { height_cm: null } };
      const n = Number(s.trim().replace(',', '.'));
      if (!Number.isFinite(n) || n < 100 || n > 250) return { ok: false, error: 'Enter your height in cm, like 162.' };
      return { ok: true, patch: { height_cm: round1(n) } };
    }
    case 'pre_weight_kg': {
      if (!s.trim()) return { ok: true, patch: { pre_weight_kg: null } };
      const n = Number(s.trim().replace(',', '.'));
      const kg = p.units === 'imperial' ? n / LB_PER_KG : n;
      if (!Number.isFinite(kg) || kg < 25 || kg > 300) {
        return { ok: false, error: p.units === 'imperial' ? 'Enter a weight in lb, like 130.' : 'Enter a weight in kg, like 59.' };
      }
      return { ok: true, patch: { pre_weight_kg: Math.round(kg * 100) / 100 } };
    }
    case 'blood_group':
      return { ok: true, patch: { blood_group: s && s !== "Don't know" ? s.replace('−', '-') : null } };
    case 'conditions':
      return { ok: true, patch: { conditions: (Array.isArray(draft) ? draft : []).filter((c) => c !== 'None') } };
    default:
      return { ok: true, patch: { [key]: text(s) } };
  }
}

/** First letter of the name for the round avatar. */
export function initialOf(name: string | null | undefined): string {
  const letter = (name ?? '').replace(/[^\p{L}]/gu, '')[0];
  return (letter ?? 'B').toUpperCase();
}

/** "123 456" for reading a code aloud. */
export function spacedCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** "Expires in 47 hours" / "Expires in 20 minutes". */
export function expiresIn(expiresAt: string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 60000));
  if (mins >= 120) return `Expires in ${Math.floor(mins / 60)} hours`;
  if (mins >= 60) return 'Expires in 1 hour';
  return `Expires in ${mins} minute${mins === 1 ? '' : 's'}`;
}
