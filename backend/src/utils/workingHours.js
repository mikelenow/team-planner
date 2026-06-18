const { startOfWeek, format, getDay } = require('date-fns');

/**
 * Working-hours resolution that honours per-week schedule overrides.
 *
 * A Person has default hoursMonday..hoursFriday. A WeeklySchedule row, keyed by
 * the Monday of a week, can override those hours for that specific week (e.g.
 * working Mon/Tue one week and Thu/Fri the next). A day set to 0 = not working.
 */

const DAY_FIELDS = {
  1: 'hoursMonday',
  2: 'hoursTuesday',
  3: 'hoursWednesday',
  4: 'hoursThursday',
  5: 'hoursFriday',
};

/** Normalised Monday (yyyy-MM-dd) of the week containing `date`. */
function weekStartKey(date) {
  return format(startOfWeek(new Date(date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Build a lookup of `${personId}|${weekStartKey}` -> WeeklySchedule from a flat
 * list of schedule rows (as fetched from prisma).
 */
function buildScheduleLookup(schedules) {
  const map = new Map();
  for (const s of schedules) {
    map.set(`${s.personId}|${weekStartKey(s.weekStart)}`, s);
  }
  return map;
}

/**
 * Hours a person works on a given date, applying any weekly override.
 * Returns 0 for weekends. Does NOT account for holidays/absences — callers
 * subtract those as before.
 *
 * @param {object} person   Person with default hoursMonday..hoursFriday
 * @param {Date|string} date
 * @param {Map} [lookup]    optional lookup from buildScheduleLookup()
 */
function getDailyHours(person, date, lookup) {
  const dow = getDay(new Date(date));
  const field = DAY_FIELDS[dow];
  if (!field) return 0; // weekend

  if (lookup) {
    const override = lookup.get(`${person.id}|${weekStartKey(date)}`);
    if (override) return override[field] ?? 0;
  }
  return person[field];
}

module.exports = { weekStartKey, buildScheduleLookup, getDailyHours, DAY_FIELDS };
