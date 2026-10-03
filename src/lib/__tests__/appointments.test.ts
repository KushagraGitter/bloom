import {
  addMonths,
  byWhen,
  cardLine,
  clock,
  dayNumber,
  localTime,
  metaLine,
  monthAbbr,
  monthOf,
  monthWeeks,
  newAppointmentRow,
  nextUp,
  onDay,
  toAppointment,
  upcoming,
  type Appointment,
} from '../appointments';

function appt(id: string, appt_date: string, appt_time: string | null = null, place: string | null = null): Appointment {
  return { id, pregnancy_id: 'p1', title: `Title ${id}`, appt_date, appt_time, place };
}

const ids = (list: Appointment[]) => list.map((a) => a.id);

describe('toAppointment', () => {
  it('cuts the database time down to hours and minutes', () => {
    expect(toAppointment(appt('a', '2026-10-14', '09:00:00')).appt_time).toBe('09:00');
    expect(toAppointment(appt('a', '2026-10-14', '09:00')).appt_time).toBe('09:00');
  });

  it('keeps a missing time missing', () => {
    expect(toAppointment(appt('a', '2026-10-14', null)).appt_time).toBeNull();
  });
});

describe('ordering', () => {
  const list = [
    appt('late', '2026-10-14', '15:00'),
    appt('later-day', '2026-10-20', '08:00'),
    appt('early', '2026-10-14', '09:00'),
    appt('no-time', '2026-10-14'),
    appt('past', '2026-10-02', '10:00'),
    appt('today', '2026-10-03', '08:00'),
  ];

  it('sorts by day, then time, with an untimed one first on its day', () => {
    expect(ids([...list].sort(byWhen))).toEqual(['past', 'today', 'no-time', 'early', 'late', 'later-day']);
  });

  it('breaks a tie by id so both phones agree', () => {
    expect(ids([appt('b', '2026-10-14', '09:00'), appt('a', '2026-10-14', '09:00')].sort(byWhen))).toEqual(['a', 'b']);
  });

  it('lists today and later, not earlier days', () => {
    expect(ids(upcoming(list, '2026-10-03'))).toEqual(['today', 'no-time', 'early', 'late', 'later-day']);
    expect(ids(upcoming(list, '2026-10-15'))).toEqual(['later-day']);
    expect(upcoming(list, '2026-11-01')).toEqual([]);
  });

  it('lists one day in order', () => {
    expect(ids(onDay(list, '2026-10-14'))).toEqual(['no-time', 'early', 'late']);
    expect(onDay(list, '2026-10-15')).toEqual([]);
  });

  it('does not change the list it is given', () => {
    const copy = [...list];
    upcoming(list, '2026-10-03');
    onDay(list, '2026-10-14');
    expect(list).toEqual(copy);
  });
});

describe('nextUp', () => {
  const list = [appt('morning', '2026-10-03', '09:00'), appt('evening', '2026-10-03', '18:30'), appt('tomorrow', '2026-10-04', '08:00')];

  it('skips one whose time has passed today', () => {
    expect(nextUp(list, '2026-10-03', '10:00')?.id).toBe('evening');
  });

  it('counts one that is starting right now', () => {
    expect(nextUp(list, '2026-10-03', '09:00')?.id).toBe('morning');
  });

  it('moves on to a later day once today is done', () => {
    expect(nextUp(list, '2026-10-03', '19:00')?.id).toBe('tomorrow');
  });

  it('keeps one with no time all day', () => {
    expect(nextUp([appt('open', '2026-10-03')], '2026-10-03', '23:59')?.id).toBe('open');
  });

  it('is undefined when nothing is left', () => {
    expect(nextUp(list, '2026-10-05', '08:00')).toBeUndefined();
    expect(nextUp([], '2026-10-03', '08:00')).toBeUndefined();
  });
});

describe('localTime', () => {
  it('pads hours and minutes', () => {
    expect(localTime(new Date(2026, 9, 3, 7, 5))).toBe('07:05');
    expect(localTime(new Date(2026, 9, 3, 18, 30))).toBe('18:30');
    expect(localTime(new Date(2026, 9, 3, 0, 0))).toBe('00:00');
  });
});

describe('months', () => {
  it('knows which month a day is in', () => {
    expect(monthOf('2026-10-14')).toBe('2026-10');
  });

  it('steps forward and back, across years', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-10', -13)).toBe('2025-09');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
  });
});

describe('monthWeeks', () => {
  const days = (weeks: ReturnType<typeof monthWeeks>) => weeks.flat().filter((c) => c !== null);

  it('starts the week on Monday, with blanks before the 1st', () => {
    // 1 October 2026 is a Thursday.
    const weeks = monthWeeks('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0].map((c) => c?.n ?? null)).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(weeks[0][3]).toEqual({ n: 1, day: '2026-10-01' });
    expect(weeks[4].map((c) => c?.n ?? null)).toEqual([26, 27, 28, 29, 30, 31, null]);
  });

  it('gives every week seven cells', () => {
    for (const month of ['2026-02', '2026-06', '2026-08', '2027-02']) {
      for (const week of monthWeeks(month)) expect(week).toHaveLength(7);
    }
  });

  it('has no blanks before a month that starts on Monday', () => {
    // 1 June 2026 is a Monday.
    expect(monthWeeks('2026-06')[0][0]).toEqual({ n: 1, day: '2026-06-01' });
  });

  it('puts the 1st last in the first week when the month starts on Sunday', () => {
    // 1 February 2026 is a Sunday.
    const first = monthWeeks('2026-02')[0];
    expect(first.slice(0, 6)).toEqual(Array(6).fill(null));
    expect(first[6]).toEqual({ n: 1, day: '2026-02-01' });
  });

  it('needs only four weeks when the month fits exactly', () => {
    // February 2027 starts on a Monday and has 28 days.
    expect(monthWeeks('2027-02')).toHaveLength(4);
  });

  it('needs six weeks when the month starts late in the week', () => {
    // August 2026 starts on a Saturday and has 31 days.
    expect(monthWeeks('2026-08')).toHaveLength(6);
  });

  it('has the right number of days, leap years included', () => {
    expect(days(monthWeeks('2026-10'))).toHaveLength(31);
    expect(days(monthWeeks('2026-11'))).toHaveLength(30);
    expect(days(monthWeeks('2027-02'))).toHaveLength(28);
    expect(days(monthWeeks('2028-02'))).toHaveLength(29);
  });

  it('numbers the days in order with full dates', () => {
    expect(days(monthWeeks('2026-11')).map((c) => c!.day)).toEqual(
      Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`),
    );
  });
});

describe('words on screen', () => {
  it('writes a clock time the way the phone does', () => {
    expect(clock('09:00')).toMatch(/\b9[:.]00/);
    expect(clock('13:05')).toMatch(/\b(1|13)[:.]05/);
    expect(clock('00:30')).toMatch(/\b(12|0|00)[:.]30/);
  });

  it('names the month on a date tile in capitals', () => {
    expect(monthAbbr('2026-10-14')).toBe(monthAbbr('2026-10-14').toUpperCase());
    expect(monthAbbr('2026-10-14')).not.toBe(monthAbbr('2026-11-14'));
  });

  it('reads the day number off the date', () => {
    expect(dayNumber('2026-10-04')).toBe(4);
    expect(dayNumber('2026-10-24')).toBe(24);
  });

  it('puts the time first in the list and the place first on Today', () => {
    const both = { appt_time: '09:00', place: 'City Clinic' };
    expect(metaLine(both)).toBe(`${clock('09:00')} · City Clinic`);
    expect(cardLine(both)).toBe(`City Clinic · ${clock('09:00')}`);
  });

  it('shows whichever of time and place there is', () => {
    expect(metaLine({ appt_time: '09:00', place: null })).toBe(clock('09:00'));
    expect(metaLine({ appt_time: null, place: 'City Clinic' })).toBe('City Clinic');
    expect(cardLine({ appt_time: '09:00', place: null })).toBe(clock('09:00'));
    expect(cardLine({ appt_time: null, place: 'City Clinic' })).toBe('City Clinic');
  });

  it('says there is no time when there is neither', () => {
    expect(metaLine({ appt_time: null, place: null })).toBe('No time set');
    expect(cardLine({ appt_time: null, place: null })).toBe('No time set');
  });
});

describe('newAppointmentRow', () => {
  const valid = { title: 'Growth scan', date: '2026-11-11', time: '10:00', place: 'City Clinic' };

  it('makes a row from a complete form', () => {
    expect(newAppointmentRow(valid)).toEqual({
      ok: true,
      row: { title: 'Growth scan', appt_date: '2026-11-11', appt_time: '10:00', place: 'City Clinic' },
    });
  });

  it('trims the words and treats an empty time and place as none', () => {
    expect(newAppointmentRow({ title: '  Growth scan  ', date: '2026-11-11', time: '', place: '   ' })).toEqual({
      ok: true,
      row: { title: 'Growth scan', appt_date: '2026-11-11', appt_time: null, place: null },
    });
  });

  it('needs a title', () => {
    expect(newAppointmentRow({ ...valid, title: '   ' })).toEqual({ ok: false, error: 'Enter what the appointment is for.' });
  });

  it('needs a date', () => {
    expect(newAppointmentRow({ ...valid, date: '' })).toEqual({ ok: false, error: 'Pick a date.' });
  });

  it('keeps the title and place within what the database allows', () => {
    expect(newAppointmentRow({ ...valid, title: 'x'.repeat(80) }).ok).toBe(true);
    expect(newAppointmentRow({ ...valid, title: 'x'.repeat(81) })).toEqual({
      ok: false,
      error: 'Keep the title to 80 characters or fewer.',
    });
    expect(newAppointmentRow({ ...valid, place: 'x'.repeat(120) }).ok).toBe(true);
    expect(newAppointmentRow({ ...valid, place: 'x'.repeat(121) })).toEqual({
      ok: false,
      error: 'Keep the place to 120 characters or fewer.',
    });
  });
});
