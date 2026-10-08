import {
  dueDateFromLmp,
  gestationalAge,
  lmpFrom,
  type DatingMethod,
  type GestationalAge,
} from '@/lib/pregnancy';

export type Method = 'lmp' | 'due' | 'ivf';
export type ReminderKind = 'vitamins' | 'water' | 'kicks' | 'appointments';

export const BABY_OPTIONS = ['One', 'Twins', 'More'] as const;
export const SEX_OPTIONS = ['Girl', 'Boy', 'Surprise'] as const;
export const FIRST_OPTIONS = ['Yes, first baby', 'No, I have little ones'] as const;
export const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', "Don't know"] as const;
export const CONDITIONS = ['Thyroid', 'Diabetes', 'Blood pressure', 'Anaemia', 'PCOS', 'None'] as const;

export const REMINDERS: { kind: ReminderKind; label: string; sub: string }[] = [
  { kind: 'vitamins', label: 'Vitamins', sub: 'At the times you set' },
  { kind: 'water', label: 'Drink water', sub: 'Every 2 hours, 9 am – 8 pm' },
  { kind: 'kicks', label: 'Kick counts', sub: 'Daily, from week 28' },
  { kind: 'appointments', label: 'Appointments', sub: 'A day before and 2 hours before' },
];

export type Answers = {
  name: string;
  method: Method;
  /** YYYY-MM-DD: LMP, due date or transfer date depending on `method`. */
  date: string;
  embryoDay: 3 | 5;
  first: (typeof FIRST_OPTIONS)[number] | '';
  babies: (typeof BABY_OPTIONS)[number];
  sex: (typeof SEX_OPTIONS)[number];
  nickname: string;
  heightCm: string;
  preWeightKg: string;
  bloodGroup: (typeof BLOOD_GROUPS)[number] | '';
  conditions: string[];
  doctor: string;
  hospital: string;
  emergencyContact: string;
  emergencyPhone: string;
  reminders: Record<ReminderKind, boolean>;
};

export const emptyAnswers: Answers = {
  name: '',
  method: 'lmp',
  date: '',
  embryoDay: 5,
  first: '',
  babies: 'One',
  sex: 'Surprise',
  nickname: '',
  heightCm: '',
  preWeightKg: '',
  bloodGroup: '',
  conditions: [],
  doctor: '',
  hospital: '',
  emergencyContact: '',
  emergencyPhone: '',
  reminders: { vitamins: true, water: true, kicks: true, appointments: true },
};

/** A pregnancy is accepted if today falls between its LMP and 42 weeks. */
const MAX_DAYS = 294;

export type Dating =
  | { ok: true; lmpDate: string; dueDate: string; age: GestationalAge }
  | { ok: false };

export function datingFor(a: Pick<Answers, 'method' | 'date' | 'embryoDay'>, today: string): Dating {
  if (!a.date) return { ok: false };
  let input: DatingMethod;
  if (a.method === 'lmp') input = { method: 'lmp', lmpDate: a.date };
  else if (a.method === 'due') input = { method: 'due', dueDate: a.date };
  else input = { method: 'ivf', transferDate: a.date, embryoDay: a.embryoDay };

  let lmpDate: string;
  try {
    lmpDate = lmpFrom(input);
  } catch {
    return { ok: false };
  }
  const age = gestationalAge(lmpDate, today);
  // gestationalAge clamps future LMPs to 0, so check the raw span too.
  if (lmpDate > today || age.totalDays > MAX_DAYS) return { ok: false };
  return { ok: true, lmpDate, dueDate: dueDateFromLmp(lmpDate), age };
}

function optionalNumber(text: string, min: number, max: number): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!text.trim() || !Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}

function optionalText(text: string): string | null {
  const t = text.trim();
  return t ? t : null;
}

/** The pregnancy details onboarding saves (on the phone, in the vault). Throws if the date is not usable. */
export function toPregnancyDetails(a: Answers, today: string) {
  const dating = datingFor(a, today);
  if (!dating.ok) throw new Error('The pregnancy date is missing or out of range.');
  return {
    lmp_date: dating.lmpDate,
    method: a.method,
    ivf_transfer_date: a.method === 'ivf' ? a.date : null,
    ivf_embryo_day: a.method === 'ivf' ? a.embryoDay : null,
    babies: BABY_OPTIONS.indexOf(a.babies) + 1,
    first_pregnancy: a.first === '' ? null : a.first === FIRST_OPTIONS[0],
    sex: a.sex === 'Girl' ? 'girl' : a.sex === 'Boy' ? 'boy' : 'unknown',
    nickname: optionalText(a.nickname),
    height_cm: optionalNumber(a.heightCm, 100, 250),
    pre_weight_kg: optionalNumber(a.preWeightKg, 25, 300),
    blood_group: a.bloodGroup && a.bloodGroup !== "Don't know" ? a.bloodGroup.replace('−', '-') : null,
    conditions: a.conditions.filter((c) => c !== 'None'),
    doctor: optionalText(a.doctor),
    hospital: optionalText(a.hospital),
    emergency_contact: optionalText(a.emergencyContact),
    emergency_phone: optionalText(a.emergencyPhone),
  };
}

/** Selecting "None" clears the others; selecting anything else clears "None". */
export function toggleCondition(current: string[], picked: string): string[] {
  if (picked === 'None') return current.includes('None') ? [] : ['None'];
  const rest = current.filter((c) => c !== 'None');
  return rest.includes(picked) ? rest.filter((c) => c !== picked) : [...rest, picked];
}
