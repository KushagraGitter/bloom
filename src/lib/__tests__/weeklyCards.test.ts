import { WEEKLY_CARDS } from '@/content/weeklyCards';
import {
  CARD_KINDS,
  CARD_WEEKS,
  FIRST_CARD_WEEK,
  LAST_CARD_WEEK,
  cardLabel,
  cardsFor,
  deckOrder,
  deckWeek,
  unseenCount,
  withSeen,
} from '@/lib/weeklyCards';

const words = (text: string) => text.trim().split(/\s+/).length;

describe('the weekly card content', () => {
  const all = Object.entries(WEEKLY_CARDS).flatMap(([week, cards]) =>
    CARD_KINDS.map((kind) => ({ where: `week ${week} ${kind}`, ...cards[kind] })),
  );

  it('has a full deck for every week from 4 to 41', () => {
    const expected = Array.from({ length: LAST_CARD_WEEK - FIRST_CARD_WEEK + 1 }, (_, i) => FIRST_CARD_WEEK + i);
    expect(CARD_WEEKS).toEqual(expected);
    for (const week of expected) {
      expect(Object.keys(WEEKLY_CARDS[week]).sort()).toEqual([...CARD_KINDS].sort());
    }
  });

  it('keeps fronts to one short line and backs to two short paragraphs', () => {
    for (const card of all) {
      expect({ where: card.where, front: words(card.front) <= 10 }).toEqual({ where: card.where, front: true });
      expect({ where: card.where, back: words(card.back) >= 25 && words(card.back) <= 120 && card.back.split('\n\n').length <= 2 }).toEqual({ where: card.where, back: true });
    }
  });

  it('never labels anything normal or abnormal, or tells her what she should or must do', () => {
    const banned = /\b(normal|abnormal|should|must|risk|failure|fail)\b/i;
    for (const card of all) {
      expect({ where: card.where, text: `${card.front} ${card.back}`.match(banned)?.[0] ?? null }).toEqual({ where: card.where, text: null });
    }
  });

  it('uses curly quotes and apostrophes like the rest of the app', () => {
    for (const card of all) {
      expect({ where: card.where, straight: /['"]/.test(card.front + card.back) }).toEqual({ where: card.where, straight: false });
    }
  });
});

describe('deckWeek', () => {
  it('has no deck before week 4, then the current week, and week 41’s after it', () => {
    expect(deckWeek(0)).toBeNull();
    expect(deckWeek(3)).toBeNull();
    expect(deckWeek(4)).toBe(4);
    expect(deckWeek(24)).toBe(24);
    expect(deckWeek(41)).toBe(41);
    expect(deckWeek(43)).toBe(41);
  });

  it('finds a week’s cards, and none for weeks without a deck', () => {
    expect(cardsFor(24)?.baby.front).toBeTruthy();
    expect(cardsFor(3)).toBeNull();
    expect(cardsFor(42)).toBeNull();
  });
});

describe('deckOrder and cardLabel', () => {
  it('opens the partner’s deck on their own card and keeps the rest in order', () => {
    expect(deckOrder('owner')).toEqual(['baby', 'body', 'try', 'partner', 'thought']);
    expect(deckOrder('partner')).toEqual(['partner', 'baby', 'body', 'try', 'thought']);
  });

  it('names the partner card after the partner’s first name', () => {
    expect(cardLabel('partner', 'Kush Sharma')).toBe('For Kush');
    expect(cardLabel('partner', '  ')).toBe('For your partner');
    expect(cardLabel('partner', null)).toBe('For your partner');
    expect(cardLabel('body', 'Kush')).toBe('Your body');
  });
});

describe('seen cards', () => {
  it('adds a card once, in deck order, ignoring anything it does not know', () => {
    expect(withSeen([], 'thought')).toEqual(['thought']);
    expect(withSeen(['thought', 'baby'], 'body')).toEqual(['baby', 'body', 'thought']);
    expect(withSeen(['baby'], 'baby')).toEqual(['baby']);
    expect(withSeen(['nonsense'], 'try')).toEqual(['try']);
  });

  it('counts the cards not looked at yet', () => {
    expect(unseenCount(undefined)).toBe(5);
    expect(unseenCount(['baby', 'body'])).toBe(3);
    expect(unseenCount(CARD_KINDS)).toBe(0);
  });
});
