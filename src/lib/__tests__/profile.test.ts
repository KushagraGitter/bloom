import { displayFor, draftFor, expiresIn, initialOf, patchFor, spacedCode, type PregnancyRow } from '../profile';

const base: PregnancyRow = {
  id: 'p1',
  owner_id: 'u1',
  lmp_date: '2026-04-15',
  due_date: '2027-01-20',
  method: 'ivf',
  babies: 2,
  first_pregnancy: true,
  sex: 'unknown',
  nickname: null,
  height_cm: 162,
  pre_weight_kg: 59,
  blood_group: 'B-',
  conditions: ['Thyroid'],
  allergies: null,
  doctor: 'Dr Mehta',
  hospital: null,
  hospital_phone: null,
  emergency_contact: null,
  emergency_phone: null,
  units: 'metric',
};

const today = '2026-10-03';

describe('profile rows', () => {
  it('shows stored values the way onboarding asked for them', () => {
    expect(draftFor(base, 'babies')).toBe('Twins');
    expect(draftFor(base, 'first_pregnancy')).toBe('Yes');
    expect(draftFor(base, 'sex')).toBe('Surprise');
    expect(draftFor(base, 'blood_group')).toBe('B−');
    expect(displayFor(base, 'height_cm')).toBe('162 cm');
    expect(displayFor(base, 'pre_weight_kg')).toBe('59 kg');
    expect(displayFor({ ...base, units: 'imperial' }, 'pre_weight_kg')).toBe('130.1 lb');
    expect(displayFor(base, 'conditions')).toBe('Thyroid');
    expect(displayFor(base, 'nickname')).toBe('');
    expect(displayFor({ ...base, first_pregnancy: null }, 'first_pregnancy')).toBe('');
  });

  it('turns edits back into columns', () => {
    expect(patchFor(base, 'babies', 'More', today)).toEqual({ ok: true, patch: { babies: 3 } });
    expect(patchFor(base, 'first_pregnancy', 'No', today)).toEqual({ ok: true, patch: { first_pregnancy: false } });
    expect(patchFor(base, 'sex', 'Girl', today)).toEqual({ ok: true, patch: { sex: 'girl' } });
    expect(patchFor(base, 'blood_group', 'AB−', today)).toEqual({ ok: true, patch: { blood_group: 'AB-' } });
    expect(patchFor(base, 'blood_group', "Don't know", today)).toEqual({ ok: true, patch: { blood_group: null } });
    expect(patchFor(base, 'conditions', ['None'], today)).toEqual({ ok: true, patch: { conditions: [] } });
    expect(patchFor(base, 'doctor', '  ', today)).toEqual({ ok: true, patch: { doctor: null } });
    expect(patchFor(base, 'nickname', ' Peanut ', today)).toEqual({ ok: true, patch: { nickname: 'Peanut' } });
  });

  it('checks numbers and converts lb to kg', () => {
    expect(patchFor(base, 'height_cm', '40', today).ok).toBe(false);
    expect(patchFor(base, 'height_cm', '', today)).toEqual({ ok: true, patch: { height_cm: null } });
    expect(patchFor({ ...base, units: 'imperial' }, 'pre_weight_kg', '130', today)).toEqual({ ok: true, patch: { pre_weight_kg: 58.97 } });
    expect(patchFor(base, 'pre_weight_kg', 'abc', today).ok).toBe(false);
  });

  it('makes an edited period date the dating method', () => {
    expect(patchFor(base, 'lmp_date', '2026-05-01', today)).toEqual({
      ok: true,
      patch: { lmp_date: '2026-05-01', method: 'lmp', ivf_transfer_date: null, ivf_embryo_day: null },
    });
    expect(patchFor(base, 'lmp_date', '2026-11-01', today).ok).toBe(false);
    expect(patchFor(base, 'lmp_date', '2025-10-01', today).ok).toBe(false);
  });
});

describe('small formatters', () => {
  it('formats codes, expiry and initials', () => {
    expect(spacedCode('123456')).toBe('123 456');
    const now = new Date('2026-10-03T10:00:00Z');
    expect(expiresIn('2026-10-05T09:30:00Z', now)).toBe('Expires in 47 hours');
    expect(expiresIn('2026-10-03T11:10:00Z', now)).toBe('Expires in 1 hour');
    expect(expiresIn('2026-10-03T10:01:00Z', now)).toBe('Expires in 1 minute');
    expect(initialOf(' ananya')).toBe('A');
    expect(initialOf(null)).toBe('B');
  });
});
