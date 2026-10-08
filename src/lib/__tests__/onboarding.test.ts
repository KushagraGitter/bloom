import { datingFor, emptyAnswers, toggleCondition, toPregnancyDetails, type Answers } from '../onboarding';

const today = '2026-10-03';

describe('datingFor', () => {
  it('needs a date', () => {
    expect(datingFor(emptyAnswers, today)).toEqual({ ok: false });
  });

  it('dates from the last period', () => {
    const d = datingFor({ ...emptyAnswers, date: '2026-04-15' }, today);
    expect(d).toMatchObject({ ok: true, lmpDate: '2026-04-15', dueDate: '2027-01-20' });
    if (d.ok) expect(d.age).toMatchObject({ weeks: 24, days: 3, trimester: 2 });
  });

  it('dates from a due date', () => {
    expect(datingFor({ ...emptyAnswers, method: 'due', date: '2027-01-20' }, today)).toMatchObject({
      ok: true,
      lmpDate: '2026-04-15',
    });
  });

  it('dates from an IVF transfer', () => {
    expect(
      datingFor({ ...emptyAnswers, method: 'ivf', date: '2026-05-04', embryoDay: 5 }, today),
    ).toMatchObject({ ok: true, lmpDate: '2026-04-15' });
  });

  it('rejects a last period in the future or more than 42 weeks ago', () => {
    expect(datingFor({ ...emptyAnswers, date: '2026-10-04' }, today)).toEqual({ ok: false });
    expect(datingFor({ ...emptyAnswers, date: '2025-12-12' }, today)).toEqual({ ok: false });
    expect(datingFor({ ...emptyAnswers, date: '2025-12-13' }, today)).toMatchObject({ ok: true });
  });

  it('rejects impossible dates instead of throwing', () => {
    expect(datingFor({ ...emptyAnswers, date: '2026-02-30' }, today)).toEqual({ ok: false });
  });
});

describe('toPregnancyDetails', () => {
  const answers: Answers = {
    ...emptyAnswers,
    name: 'Ananya',
    method: 'ivf',
    date: '2026-05-04',
    embryoDay: 5,
    first: 'Yes, first baby',
    babies: 'Twins',
    sex: 'Girl',
    nickname: '  Peanut ',
    heightCm: '162',
    preWeightKg: '59,5',
    bloodGroup: 'O−',
    conditions: ['Thyroid'],
    doctor: '',
    hospital: 'City Hospital',
  };

  it('maps answers to the pregnancy details', () => {
    expect(toPregnancyDetails(answers, today)).toEqual({
      lmp_date: '2026-04-15',
      method: 'ivf',
      ivf_transfer_date: '2026-05-04',
      ivf_embryo_day: 5,
      babies: 2,
      first_pregnancy: true,
      sex: 'girl',
      nickname: 'Peanut',
      height_cm: 162,
      pre_weight_kg: 59.5,
      blood_group: 'O-',
      conditions: ['Thyroid'],
      doctor: null,
      hospital: 'City Hospital',
      emergency_contact: null,
      emergency_phone: null,
    });
  });

  it('leaves skipped and out-of-range answers empty', () => {
    const row = toPregnancyDetails(
      { ...emptyAnswers, date: '2026-04-15', heightCm: '16.2', preWeightKg: 'abc', bloodGroup: "Don't know", conditions: ['None'] },
      today,
    );
    expect(row).toMatchObject({
      method: 'lmp',
      ivf_transfer_date: null,
      ivf_embryo_day: null,
      babies: 1,
      first_pregnancy: null,
      sex: 'unknown',
      height_cm: null,
      pre_weight_kg: null,
      blood_group: null,
      conditions: [],
    });
  });

  it('refuses to build a row without a valid date', () => {
    expect(() => toPregnancyDetails(emptyAnswers, today)).toThrow();
  });
});

describe('toggleCondition', () => {
  it('adds and removes conditions', () => {
    expect(toggleCondition([], 'Thyroid')).toEqual(['Thyroid']);
    expect(toggleCondition(['Thyroid', 'PCOS'], 'Thyroid')).toEqual(['PCOS']);
  });

  it('treats None as exclusive', () => {
    expect(toggleCondition(['Thyroid'], 'None')).toEqual(['None']);
    expect(toggleCondition(['None'], 'PCOS')).toEqual(['PCOS']);
    expect(toggleCondition(['None'], 'None')).toEqual([]);
  });
});
