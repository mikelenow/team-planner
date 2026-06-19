const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { eachDayOfInterval, isWeekend, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } = require('date-fns');
const { buildScheduleLookup, getDailyHours } = require('../utils/workingHours');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * Check if a date falls within any absence period
 */
function getAbsenceForDate(absences, date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  return absences.find(a => {
    const start = format(new Date(a.startDate), 'yyyy-MM-dd');
    const end = format(new Date(a.endDate), 'yyyy-MM-dd');
    return dateStr >= start && dateStr <= end;
  });
}

/**
 * Check if a date is a public holiday
 */
function isPublicHoliday(holidays, date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  return holidays.find(h => format(new Date(h.date), 'yyyy-MM-dd') === dateStr);
}

/**
 * Get total allocation percentage for a person on a given date
 */
function getAllocationForDate(allocations, date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  return allocations
    .filter(a => {
      const start = format(new Date(a.startDate), 'yyyy-MM-dd');
      const end = format(new Date(a.endDate), 'yyyy-MM-dd');
      return dateStr >= start && dateStr <= end;
    })
    .reduce((sum, a) => sum + a.percentage, 0);
}

// GET /api/utilization?startDate=2026-01-01&endDate=2026-01-31&personId=...&teamId=...&roleId=...
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, personId, teamId, roleId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch people with filters
    const personWhere = { isActive: true };
    if (personId) personWhere.id = personId;
    if (teamId) personWhere.teamId = teamId;
    if (roleId) personWhere.roleId = roleId;

    const people = await prisma.person.findMany({
      where: personWhere,
      include: { role: true, team: true },
      orderBy: { lastName: 'asc' },
    });

    // Fetch all relevant data
    let schedules = [];
    const [allocations, absences, holidays] = await Promise.all([
      prisma.allocation.findMany({
        where: {
          startDate: { lte: end },
          endDate: { gte: start },
          personId: { in: people.map(p => p.id) },
        },
        include: { project: true },
      }),
      prisma.absence.findMany({
        where: {
          startDate: { lte: end },
          endDate: { gte: start },
          personId: { in: people.map(p => p.id) },
        },
        include: { absenceType: true },
      }),
      prisma.publicHoliday.findMany({
        where: { date: { gte: start, lte: end } },
      }),
    ]);

    // Fetch weekly schedules (non-blocking if table doesn't exist yet)
    try {
      schedules = await prisma.weeklySchedule.findMany({
        where: {
          personId: { in: people.map(p => p.id) },
          weekStart: { gte: startOfWeek(start, { weekStartsOn: 1 }), lte: end },
        },
      });
    } catch (err) {
      console.error('Failed to fetch weekly schedules:', err.message);
    }

    // Fetch tempo worklogs separately (non-blocking if table doesn't exist yet)
    let tempoWorklogs = [];
    try {
      tempoWorklogs = await prisma.tempoWorklog.findMany({
        where: {
          date: { gte: start, lte: end },
          personId: { in: people.map(p => p.id) },
        },
        select: { personId: true, date: true, timeSpentHours: true },
      });
    } catch (err) {
      console.error('Failed to fetch tempo worklogs for timeline:', err.message);
    }

    const scheduleLookup = buildScheduleLookup(schedules);

    // Build tempo worklog lookup: personId|date -> totalHours
    const tempoByPersonDate = new Map();
    for (const wl of tempoWorklogs) {
      const key = `${wl.personId}|${format(new Date(wl.date), 'yyyy-MM-dd')}`;
      tempoByPersonDate.set(key, (tempoByPersonDate.get(key) || 0) + wl.timeSpentHours);
    }

    // Calculate utilization for each person
    const days = eachDayOfInterval({ start, end });
    const results = people.map(person => {
      const personAllocations = allocations.filter(a => a.personId === person.id);
      const personAbsences = absences.filter(a => a.personId === person.id);

      let totalAvailableHours = 0;
      let totalAllocatedHours = 0;
      let totalAbsenceHours = 0;
      let totalActualHours = 0;

      const dailyData = days.map(day => {
        const baseHours = getDailyHours(person, day, scheduleLookup);

        if (baseHours === 0) {
          return { date: format(day, 'yyyy-MM-dd'), available: 0, allocated: 0, absence: 0, holiday: false, weekend: true, utilization: 0 };
        }

        const holiday = isPublicHoliday(holidays, day);
        if (holiday) {
          const absHours = holiday.isHalfDay ? baseHours / 2 : baseHours;
          return { date: format(day, 'yyyy-MM-dd'), available: 0, allocated: 0, absence: 0, holiday: true, holidayName: holiday.name, weekend: false, utilization: 0 };
        }

        const absence = getAbsenceForDate(personAbsences, day);
        let absenceHours = 0;
        if (absence) {
          absenceHours = absence.isHalfDay ? baseHours / 2 : baseHours;
        }

        const availableHours = baseHours - absenceHours;
        const allocationPct = getAllocationForDate(personAllocations, day);
        const allocatedHours = (allocationPct / 100) * baseHours;

        totalAvailableHours += availableHours;
        totalAllocatedHours += allocatedHours;
        totalAbsenceHours += absenceHours;
        totalActualHours += actualHours;

        const utilization = availableHours > 0 ? (allocatedHours / availableHours) * 100 : 0;

        const dateStr = format(day, 'yyyy-MM-dd');
        const actualHours = tempoByPersonDate.get(`${person.id}|${dateStr}`) || 0;

        return {
          date: dateStr,
          available: availableHours,
          allocated: allocatedHours,
          actual: Math.round(actualHours * 10) / 10,
          absence: absenceHours,
          absenceType: absence?.absenceType?.name || null,
          holiday: false,
          weekend: false,
          utilization: Math.round(utilization * 10) / 10,
          overallocated: utilization > 100,
          allocationPct,
        };
      });

      const overallUtilization = totalAvailableHours > 0
        ? Math.round((totalAllocatedHours / totalAvailableHours) * 100 * 10) / 10
        : 0;

      return {
        person: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          role: person.role,
          team: person.team,
          hoursMonday: person.hoursMonday,
          hoursTuesday: person.hoursTuesday,
          hoursWednesday: person.hoursWednesday,
          hoursThursday: person.hoursThursday,
          hoursFriday: person.hoursFriday,
        },
        summary: {
          totalAvailableHours: Math.round(totalAvailableHours * 10) / 10,
          totalAllocatedHours: Math.round(totalAllocatedHours * 10) / 10,
          totalAbsenceHours: Math.round(totalAbsenceHours * 10) / 10,
          totalActualHours: Math.round(totalActualHours * 10) / 10,
          utilization: overallUtilization,
          overallocated: overallUtilization > 100,
        },
        daily: dailyData,
        allocations: personAllocations.map(a => ({
          id: a.id,
          project: a.project,
          percentage: a.percentage,
          startDate: a.startDate,
          endDate: a.endDate,
        })),
      };
    });

    res.json({
      period: { startDate, endDate },
      people: results,
    });
  } catch (err) {
    console.error('Utilization error:', err);
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  }
});

module.exports = router;
