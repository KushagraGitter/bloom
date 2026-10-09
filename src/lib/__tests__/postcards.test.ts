import { POSTCARDS } from '@/content/postcards';
import {
  POSTCARD_WEEKS,
  arrivalText,
  arrivedWeeks,
  arrivesOn,
  nextWeek,
  postcardFor,
  postcardWeek,
  postmarkText,
  signOff,
} from '@/lib/postcards';
import { CARD_WEEKS } from '@/lib/weeklyCards';

const words = (text: string) => text.trim().split(/\s+/).length;

describe('the postcard notes', () => {
  it('has one for every week that has weekly cards', () => {
    expect(POSTCARD_WEEKS).toEqual(CARD_WEEKS);
  });

  it('keeps each note short enough to fit the card in handwriting', () => {
    for (const [week, note] of Object.entries(POSTCARDS)) {
      expect({ week, fits: words(note) >= 8 && words(note) <= 25 }).toEqual({ week, fits: true });
    }
  });

  it('gives no advice and uses curly apostrophes like the rest of the app', () => {
    for (const [week, note] of Object.entries(POSTCARDS)) {
      expect({ week, advice: note.match(/\b(should|must|normal|abnormal|risk)\b/i)?.[0] ?? null }).toEqual({ week, advice: null });
      expect({ week, straight: /['"]/.test(note) }).toEqual({ week, straight: false });
    }
  });
});

describe('which postcards have arrived', () => {
  it('has none before week 4, then one a week up to 41', () => {
    expect(postcardWeek(3)).toBeNull();
    expect(postcardWeek(24)).toBe(24);
    expect(postcardWeek(43)).toBe(41);
    expect(arrivedWeeks(3)).toEqual([]);
    expect(arrivedWeeks(6)).toEqual([4, 5, 6]);
    expect(postcardFor(24)).toContain('listening');
  });

  it('names the next one on its way until the last has come', () => {
    expect(nextWeek(2)).toBe(4);
    expect(nextWeek(24)).toBe(25);
    expect(nextWeek(41)).toBeNull();
  });

  it('arrives on the first day of its week', () => {
    // 24 weeks 3 days on Fri 9 Oct 2026.
    const lmp = '2026-04-21';
    expect(arrivesOn(lmp, 24)).toBe('2026-10-06');
    expect(postmarkText(arrivesOn(lmp, 24))).toBe('6 OCT');
    expect(arrivalText(arrivesOn(lmp, 25))).toBe('Tue 13 Oct');
  });

  it('is signed from the baby, or the babies', () => {
    expect(signOff(1)).toBe('From your baby');
    expect(signOff(2)).toBe('From your babies');
  });
});
