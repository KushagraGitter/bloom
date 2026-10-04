/**
 * Contraction timer: how timed contractions group into sessions, and the
 * lengths, gaps and counts the screen shows. Contractions, ended sessions and
 * her call plan are vault records. Nothing here judges the numbers: what they
 * mean is for her own doctor or midwife to say.
 */

export const CONTRACTION_KIND = 'contraction';
export const SESSION_END_KIND = 'contraction-session-end';
export const PLAN_KIND = 'contraction-plan';

/** A session ends on its own once nothing has been timed for this long. */
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;

export const PLAN_ADVICE_MAX = 300;
export const PLAN_PLACE_MAX = 80;
export const PLAN_PHONE_MAX = 30;

export type Contraction = {
  /** The session it belongs to. */
  session: string;
  /** When it started, ISO. */
  start: string;
  /** When it ended, ISO, or null while it is still going. */
  end: string | null;
  by: string;
};

/** Written when she ends a session herself. Its id is the session's id. */
export type SessionEnd = { ended: string };

/** What her doctor or midwife told her, in her words, and who to ring. */
export type CallPlan = { advice: string; place: string; phone: string };

export type TimedContraction = Contraction & { id: string };

export type Row = {
  id: string;
  start: string;
  /** Milliseconds. */
  length: number;
  /** Milliseconds since the previous contraction in the session started, or null for the first. */
  apart: number | null;
};

export type Session = {
  id: string;
  /** Finished contractions, oldest first. */
  rows: Row[];
  /** The contraction still going, if any. */
  running: TimedContraction | null;
  /** When the first one started, ISO. */
  started: string;
  /** When the last one ended (or started, if it is still going), ISO. */
  lastAt: string;
  avgLength: number | null;
  avgApart: number | null;
};

const time = (iso: string) => Date.parse(iso);

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** Groups contractions into sessions, oldest first, with each session's rows and averages. */
export function toSessions(contractions: TimedContraction[]): Session[] {
  const bySession = new Map<string, TimedContraction[]>();
  for (const c of contractions) {
    const list = bySession.get(c.session) ?? [];
    list.push(c);
    bySession.set(c.session, list);
  }

  const sessions: Session[] = [];
  for (const [id, list] of bySession) {
    list.sort((a, b) => time(a.start) - time(b.start) || a.id.localeCompare(b.id));
    const finished = list.filter((c) => c.end !== null && time(c.end) >= time(c.start));
    const last = list[list.length - 1];
    const rows: Row[] = finished.map((c, i) => ({
      id: c.id,
      start: c.start,
      length: time(c.end!) - time(c.start),
      apart: i > 0 ? time(c.start) - time(finished[i - 1].start) : null,
    }));
    const lastAt = Math.max(...list.map((c) => time(c.end ?? c.start)));
    sessions.push({
      id,
      rows,
      // Only the newest one can be running. An older one left open was never
      // stopped (both phones started one at once) and is shown nowhere.
      running: last.end === null ? last : null,
      started: list[0].start,
      lastAt: new Date(lastAt).toISOString(),
      avgLength: average(rows.map((r) => r.length)),
      avgApart: average(rows.filter((r) => r.apart !== null).map((r) => r.apart!)),
    });
  }
  return sessions.sort((a, b) => time(a.started) - time(b.started) || a.id.localeCompare(b.id));
}

/**
 * The session the timer is on, and the earlier ones, newest first. The
 * newest session is current unless she ended it, or nothing has been timed
 * in it for `SESSION_IDLE_MS` and nothing in it is still going.
 */
export function splitSessions(
  sessions: Session[],
  endedIds: Iterable<string>,
  now: number = Date.now(),
): { current: Session | null; earlier: Session[] } {
  const ended = new Set(endedIds);
  const newest = sessions[sessions.length - 1];
  const isCurrent =
    !!newest && !ended.has(newest.id) && (!!newest.running || now - time(newest.lastAt) < SESSION_IDLE_MS);
  const current = isCurrent ? newest : null;
  const earlier = sessions.filter((s) => s !== current && s.rows.length > 0).reverse();
  return { current, earlier };
}

/** "0:45", "5:12", or "1:02:30" past an hour. Rounds to the second. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** A spoken form for screen readers: "5 minutes 12 seconds". */
export function spoken(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  const parts = [h && part(h, 'hour'), m && part(m, 'minute'), (s || (!h && !m)) && part(s, 'second')].filter(Boolean);
  return parts.join(' ');
}

export const startTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** "Sat 3 Oct, 2:10 am". */
export function sessionLabel(session: Pick<Session, 'started'>): string {
  const d = new Date(session.started);
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${startTime(session.started)}`;
}

/** Trims her call plan and keeps each field within its limit. */
export function cleanPlan(plan: CallPlan): CallPlan {
  return {
    advice: plan.advice.trim().slice(0, PLAN_ADVICE_MAX),
    place: plan.place.trim().replace(/\s+/g, ' ').slice(0, PLAN_PLACE_MAX),
    phone: plan.phone.trim().slice(0, PLAN_PHONE_MAX),
  };
}

/** A `tel:` link for the phone number she typed, or null when it has no digits. */
export function telLink(phone: string): string | null {
  const dial = phone.replace(/[^\d+*#]/g, '').replace(/(?!^)\+/g, '');
  return /\d/.test(dial) ? `tel:${dial}` : null;
}
