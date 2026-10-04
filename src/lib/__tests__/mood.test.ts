import { SYMPTOMS, cleanSymptom, inListOrder, isBuiltIn, newestFirst, symptomList, symptomsLine, whenLabel } from '@/lib/mood';

describe('cleanSymptom', () => {
  it('trims, squashes spaces and capitalises', () => {
    expect(cleanSymptom('  itchy   skin ')).toBe('Itchy skin');
    expect(cleanSymptom('   ')).toBe('');
    expect(cleanSymptom('x'.repeat(60))).toHaveLength(40);
  });
});

describe('symptomList', () => {
  it('puts her own after the design’s list, without doubles in any case', () => {
    expect(symptomList(['Itchy skin', 'nausea', 'itchy skin', 'Nosebleeds'])).toEqual([...SYMPTOMS, 'Itchy skin', 'Nosebleeds']);
  });

  it('keeps a ticked symptom showing after it is taken off the list', () => {
    expect(symptomList([], ['Nausea', 'Hiccups'])).toEqual([...SYMPTOMS, 'Hiccups']);
  });

  it('knows the built-in ones', () => {
    expect(isBuiltIn('back pain')).toBe(true);
    expect(isBuiltIn('Hiccups')).toBe(false);
  });

  it('orders ticked symptoms as the chips show them', () => {
    expect(inListOrder(['Tired', 'Hiccups', 'Nausea'], symptomList(['Hiccups']))).toEqual(['Nausea', 'Tired', 'Hiccups']);
  });

  it('writes a line for the history', () => {
    expect(symptomsLine(['Heartburn', 'Tired'])).toBe('Heartburn · Tired');
    expect(symptomsLine([])).toBe('No symptoms');
  });
});

describe('whenLabel', () => {
  const at = (h: number, m: number, d = 3) => new Date(2026, 9, d, h, m).toISOString();
  const time = (h: number, m: number) => new Date(2026, 9, 3, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  it('says today and yesterday with the time, and the date before that', () => {
    expect(whenLabel({ day: '2026-10-03', at: at(8, 10) }, '2026-10-03')).toBe(`Today, ${time(8, 10)}`);
    expect(whenLabel({ day: '2026-10-02', at: at(21, 30, 2) }, '2026-10-03')).toBe(`Yesterday, ${time(21, 30)}`);
    expect(whenLabel({ day: '2026-10-01', at: at(9, 0, 1) }, '2026-10-03')).toBe(
      new Date(2026, 9, 1).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    );
  });
});

describe('newestFirst', () => {
  it('sorts by when it was saved', () => {
    const list = [
      { id: 'a', at: '2026-10-01T09:00:00.000Z' },
      { id: 'b', at: '2026-10-03T09:00:00.000Z' },
      { id: 'c', at: '2026-10-02T09:00:00.000Z' },
    ];
    expect(newestFirst(list).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
});
