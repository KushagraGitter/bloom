import { SESSION_IDLE_MS, cleanPlan, clock, splitSessions, spoken, telLink, toSessions, type TimedContraction } from '@/lib/contractions';

const T0 = Date.UTC(2026, 9, 4, 2, 0, 0);
const iso = (secondsAfter: number) => new Date(T0 + secondsAfter * 1000).toISOString();

/** A contraction starting `start` seconds after T0 and lasting `length` seconds (null: still going). */
const c = (id: string, start: number, length: number | null, session = 's1'): TimedContraction => ({
  id,
  session,
  start: iso(start),
  end: length === null ? null : iso(start + length),
  by: 'me',
});

describe('toSessions', () => {
  it('gives each finished contraction its length and the gap from the previous start', () => {
    const [s] = toSessions([c('b', 300, 50), c('a', 0, 40), c('c', 540, 60)]);
    expect(s.rows).toEqual([
      { id: 'a', start: iso(0), length: 40_000, apart: null },
      { id: 'b', start: iso(300), length: 50_000, apart: 300_000 },
      { id: 'c', start: iso(540), length: 60_000, apart: 240_000 },
    ]);
    expect(s.avgLength).toBe(50_000);
    expect(s.avgApart).toBe(270_000);
    expect(s.running).toBeNull();
    expect(s.started).toBe(iso(0));
    expect(s.lastAt).toBe(iso(600));
  });

  it('keeps the one still going out of the rows and the averages', () => {
    const [s] = toSessions([c('a', 0, 40), c('b', 300, null)]);
    expect(s.rows.map((r) => r.id)).toEqual(['a']);
    expect(s.running?.id).toBe('b');
    expect(s.avgLength).toBe(40_000);
    expect(s.avgApart).toBeNull();
    expect(s.lastAt).toBe(iso(300));
  });

  it('only counts the newest as running, so one left open earlier is not', () => {
    const [s] = toSessions([c('a', 0, null), c('b', 300, 40)]);
    expect(s.running).toBeNull();
    expect(s.rows.map((r) => r.id)).toEqual(['b']);
    expect(s.rows[0].apart).toBeNull();
  });

  it('has no averages before anything is finished', () => {
    const [s] = toSessions([c('a', 0, null)]);
    expect(s.avgLength).toBeNull();
    expect(s.avgApart).toBeNull();
  });

  it('keeps sessions apart, oldest first', () => {
    const sessions = toSessions([c('x', 9000, 30, 's2'), c('a', 0, 40, 's1'), c('b', 300, 40, 's1')]);
    expect(sessions.map((s) => [s.id, s.rows.length])).toEqual([
      ['s1', 2],
      ['s2', 1],
    ]);
    expect(sessions[1].rows[0].apart).toBeNull();
  });
});

describe('splitSessions', () => {
  const sessions = toSessions([c('a', 0, 40, 's1'), c('b', 9000, 30, 's2')]);
  const lastAt = T0 + 9030 * 1000;

  it('treats the newest session as current while it is recent', () => {
    const { current, earlier } = splitSessions(sessions, [], lastAt + SESSION_IDLE_MS - 1);
    expect(current?.id).toBe('s2');
    expect(earlier.map((s) => s.id)).toEqual(['s1']);
  });

  it('lets a session end on its own after a long quiet spell', () => {
    const { current, earlier } = splitSessions(sessions, [], lastAt + SESSION_IDLE_MS);
    expect(current).toBeNull();
    expect(earlier.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('keeps a session with one still going, however long ago it started', () => {
    const open = toSessions([c('a', 0, null)]);
    expect(splitSessions(open, [], T0 + 10 * SESSION_IDLE_MS).current?.id).toBe('s1');
  });

  it('ends a session she ended', () => {
    const { current, earlier } = splitSessions(sessions, ['s2'], lastAt);
    expect(current).toBeNull();
    expect(earlier.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('leaves out an earlier session with nothing finished in it', () => {
    const list = toSessions([c('a', 0, null, 's1'), c('b', 300, 30, 's2')]);
    expect(splitSessions(list, [], T0 + 400_000).earlier).toEqual([]);
  });
});

describe('clock and spoken', () => {
  it('shows minutes and seconds, and hours past an hour', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(45_400)).toBe('0:45');
    expect(clock(312_000)).toBe('5:12');
    expect(clock(3_750_000)).toBe('1:02:30');
    expect(clock(-5000)).toBe('0:00');
  });

  it('reads out a length', () => {
    expect(spoken(312_000)).toBe('5 minutes 12 seconds');
    expect(spoken(61_000)).toBe('1 minute 1 second');
    expect(spoken(3_600_000)).toBe('1 hour');
    expect(spoken(0)).toBe('0 seconds');
  });
});

describe('call plan', () => {
  it('trims what she typed', () => {
    expect(cleanPlan({ advice: '  Call when 5 min apart \n', place: ' City   Hospital ', phone: ' 020 7946 0000 ' })).toEqual({
      advice: 'Call when 5 min apart',
      place: 'City Hospital',
      phone: '020 7946 0000',
    });
  });

  it('makes a dialable link from the phone number', () => {
    expect(telLink('+44 (20) 7946-0000')).toBe('tel:+442079460000');
    expect(telLink('ext 12')).toBe('tel:12');
    expect(telLink('ask at desk')).toBeNull();
    expect(telLink('')).toBeNull();
  });
});
