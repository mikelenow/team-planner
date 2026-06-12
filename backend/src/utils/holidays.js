/**
 * Austrian Public Holidays - Steiermark (Styria)
 * Dynamically calculates holidays for any given year.
 * 
 * Fixed holidays + Easter-based movable holidays + Steiermark-specific
 */

function getEasterDate(year) {
  // Meeus/Jones/Butcher algorithm for Easter Sunday
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getAustrianHolidays(year) {
  const easter = getEasterDate(year);

  const holidays = [
    // Fixed holidays
    { name: 'Neujahr', date: new Date(year, 0, 1) },
    { name: 'Heilige Drei Könige', date: new Date(year, 0, 6) },
    { name: 'Staatsfeiertag', date: new Date(year, 4, 1) },
    { name: 'Mariä Himmelfahrt', date: new Date(year, 7, 15) },
    { name: 'Nationalfeiertag', date: new Date(year, 9, 26) },
    { name: 'Allerheiligen', date: new Date(year, 10, 1) },
    { name: 'Mariä Empfängnis', date: new Date(year, 11, 8) },
    { name: 'Christtag', date: new Date(year, 11, 25) },
    { name: 'Stefanitag', date: new Date(year, 11, 26) },

    // Easter-based movable holidays
    { name: 'Ostermontag', date: addDays(easter, 1) },
    { name: 'Christi Himmelfahrt', date: addDays(easter, 39) },
    { name: 'Pfingstmontag', date: addDays(easter, 50) },
    { name: 'Fronleichnam', date: addDays(easter, 60) },

    // Steiermark-specific: Josefitag (March 19) - not a public holiday but 
    // traditionally observed. Including as note - uncomment if needed:
    // { name: 'Josefitag (Steiermark)', date: new Date(year, 2, 19) },
  ];

  return holidays.map(h => ({
    ...h,
    date: h.date,
    isHalfDay: false,
  }));
}

module.exports = { getAustrianHolidays, getEasterDate };
