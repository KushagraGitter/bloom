import {
  GROWTH_WEEKS,
  HEAD_TO_HEEL_FROM,
  POINTS_PER_CM,
  growthFor,
  lengthText,
  lifeSize,
  measuredText,
  produceBox,
  screenComparison,
  weightComparison,
  weightText,
} from '@/lib/growth';
import { cardsFor } from '@/lib/weeklyCards';
import { produceFill } from '@/theme/produce';

describe('the growth table', () => {
  it('has every week from 4 to 41, each with a fruit name and a colour', () => {
    expect(GROWTH_WEEKS).toEqual(Array.from({ length: 38 }, (_, i) => i + 4));
    for (const week of GROWTH_WEEKS) {
      expect(growthFor(week)?.name).toBeTruthy();
      expect(produceFill[week]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('never shrinks from one week to the next', () => {
    for (const week of GROWTH_WEEKS.slice(1)) {
      const now = growthFor(week)!;
      const before = growthFor(week - 1)!;
      expect({ week, longer: now.lengthCm >= before.lengthCm, heavier: now.weightG >= before.weightG }).toEqual({ week, longer: true, heavier: true });
    }
  });

  it('gives the same length as the weekly baby card wherever that card names one', () => {
    for (const week of GROWTH_WEEKS) {
      const said = cardsFor(week)?.baby.back.match(/about (\d+(?:\.\d+)?)(cm|mm) long/);
      if (!said) continue;
      const cm = said[2] === 'mm' ? Number(said[1]) / 10 : Number(said[1]);
      expect({ week, cm: growthFor(week)!.lengthCm }).toEqual({ week, cm });
    }
  });

  it('has nothing before week 4 and shows week 41 after it', () => {
    expect(growthFor(3)).toBeNull();
    expect(growthFor(44)?.week).toBe(41);
  });

  it('says how the length is measured, which changes at week 20', () => {
    expect(HEAD_TO_HEEL_FROM).toBe(20);
    expect(measuredText(19)).toBe('head to bottom');
    expect(measuredText(20)).toBe('head to heel');
  });
});

describe('sizes in words', () => {
  it('writes lengths and weights the way the cards do', () => {
    expect(lengthText(0.2)).toBe('2 mm');
    expect(lengthText(5.4)).toBe('5.4 cm');
    expect(lengthText(30)).toBe('30 cm');
    expect(weightText(0)).toBe('under 1 g');
    expect(weightText(600)).toBe('600 g');
    expect(weightText(1150)).toBe('1.2 kg');
  });

  it('compares a weight with the heaviest everyday thing it outweighs', () => {
    expect(weightComparison(0)).toBeNull();
    expect(weightComparison(1)).toBe('About as heavy as a paperclip');
    expect(weightComparison(14)).toBe('About as heavy as three grapes');
    expect(weightComparison(240)).toBe('About as heavy as two bars of soap');
    expect(weightComparison(600)).toBe('About as heavy as a bag of pasta');
    expect(weightComparison(3500)).toBe('About as heavy as four bags of sugar');
  });

  it('compares a length too big to draw with the phone screen', () => {
    expect(screenComparison(0.3)).toBe('Less than half as long as your screen');
    expect(screenComparison(0.5)).toBe('About half as long as your screen');
    expect(screenComparison(1)).toBe('About as long as your screen');
    expect(screenComparison(2.1)).toBe('About two of your screens end to end');
    expect(screenComparison(2.4)).toBe('About 2.5 of your screens end to end');
  });
});

describe('lifeSize', () => {
  const room = { width: 300, height: 320 };

  it('draws small fruit at real size', () => {
    const size = lifeSize({ shape: 'round', lengthCm: 4 }, room, 844);
    expect(size).toEqual({ fits: true, points: 4 * POINTS_PER_CM });
  });

  it('counts screens once the drawing would not fit across or down the space', () => {
    expect(lifeSize({ shape: 'round', lengthCm: 5.4 }, room, 844).fits).toBe(false);
    const corn = lifeSize({ shape: 'corn', lengthCm: 30 }, room, 844);
    expect(corn.fits).toBe(false);
    if (!corn.fits) expect(corn.screens).toBeCloseTo((30 * POINTS_PER_CM) / 844);
  });

  it('measures pears by their height, since they stand up', () => {
    expect(produceBox('pear', 100)).toEqual({ width: 74, height: 100 });
    expect(lifeSize({ shape: 'pear', lengthCm: 4.5 }, room, 844).fits).toBe(true);
  });
});
