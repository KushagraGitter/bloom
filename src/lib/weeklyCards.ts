/**
 * The weekly cards: which deck a week shows, the order its cards come in for
 * each of you, and which ones this person has seen. The cards themselves are
 * in `@/content/weeklyCards`. What each person has seen, and the thoughts
 * saved, are vault records, so they sync between the phones unreadable to the
 * server.
 */
import { WEEKLY_CARDS } from '@/content/weeklyCards';
import { accents } from '@/theme/tokens';

export type CardKind = 'baby' | 'body' | 'try' | 'partner' | 'thought';

export type Card = { front: string; back: string };

export type WeekCards = Record<CardKind, Card>;

export const SEEN_KIND = 'card-seen';
export const SAVED_KIND = 'card-saved';

/** The first and last weeks that have a deck. */
export const FIRST_CARD_WEEK = 4;
export const LAST_CARD_WEEK = 41;

export const CARD_KINDS: CardKind[] = ['baby', 'body', 'try', 'partner', 'thought'];

/** Each card's label and fill. The partner card's label carries the partner's name. */
export const CARD_META: Record<CardKind, { label: string; tone: string }> = {
  baby: { label: 'Baby this week', tone: accents.lilac },
  body: { label: 'Your body', tone: accents.pink },
  try: { label: 'Try this week', tone: accents.mint },
  partner: { label: 'For your partner', tone: accents.yellow },
  thought: { label: 'A kind thought', tone: accents.orange },
};

/** The deck for a week of pregnancy: none before week 4, and week 41's after it. */
export function deckWeek(weeks: number): number | null {
  if (weeks < FIRST_CARD_WEEK) return null;
  return Math.min(weeks, LAST_CARD_WEEK);
}

export function cardsFor(week: number): WeekCards | null {
  return WEEKLY_CARDS[week] ?? null;
}

/** Every week with a deck, from the first. */
export const CARD_WEEKS: number[] = Object.keys(WEEKLY_CARDS)
  .map(Number)
  .sort((a, b) => a - b);

/** Her deck runs in the usual order; the partner's opens on their own card. */
export function deckOrder(role: 'owner' | 'partner'): CardKind[] {
  return role === 'partner' ? ['partner', ...CARD_KINDS.filter((k) => k !== 'partner')] : CARD_KINDS;
}

/** “For Kush”, or “For your partner” before a partner has joined or named themselves. */
export function cardLabel(kind: CardKind, partnerName?: string | null): string {
  if (kind !== 'partner') return CARD_META[kind].label;
  const first = partnerName?.trim().split(/\s+/)[0];
  return first ? `For ${first}` : CARD_META.partner.label;
}

/** One person's seen cards for one week. */
export type SeenCards = { week: number; by: string; seen: CardKind[] };

/** A kind thought kept to read again. */
export type SavedThought = { week: number; savedAt: string };

const isKind = (k: unknown): k is CardKind => CARD_KINDS.includes(k as CardKind);

/** The cards seen so far plus one more, in deck order and without repeats. */
export function withSeen(seen: readonly string[], kind: CardKind): CardKind[] {
  const set = new Set([...seen.filter(isKind), kind]);
  return CARD_KINDS.filter((k) => set.has(k));
}

/** How many of a week's cards this person has not looked at yet. */
export function unseenCount(seen: readonly string[] | undefined): number {
  const set = new Set((seen ?? []).filter(isKind));
  return CARD_KINDS.filter((k) => !set.has(k)).length;
}
