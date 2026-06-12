const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const XLSX = require('xlsx');
const { eachDayOfInterval, format, getDay } = require('date-fns');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/export/utilization?startDate=...&endDate=...&format=xlsx|csv
router.get('/utilization', async (req, res) => {
  try {
    const { startDate, endDate, format: exportFormat = 'xlsx' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const people = await prisma.person.findMany({
      where: { isActive: true },
      include: { role: true, team: true },
      orderBy: { lastName: 'asc' },
    });

    const allocations = await prisma.allocation.findMany({
      where: { startDate: { lte: end }, endDate: { gte: start } },
      include: { project: true, person: true },
    });

    const absences = await prisma.absence.findMany({
      where: { startDate: { lte: end }, endDate: { gte: start } },
      include: { absenceType: true, person: true },
    });

    const holidays = await prisma.publicHoliday.findMany({
      where: { date: { gte: start, lte: end } },
    });

    const days = eachDayOfInterval({ start, end });
    const holidayDates = new Set(holidays.map(h => format(new Date(h.date), 'yyyy-MM-dd')));

    // Build spreadsheet data
    const rows = [];

    for (const person of people) {
      const personAllocations = allocations.filter(a => a.personId === person.id);
      const personAbsences = absences.filter(a => a.personId === person.id);

      const row = {
        'Name': `${person.firstName} ${person.lastName}`,
        'Role': person.role.name,
        'Team': person.team?.name || '-',
      };

      let totalAvailable = 0;
      let totalAllocated = 0;

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dow = getDay(day);

        // Get base hours
        let baseHours = 0;
        if (dow === 1) baseHours = person.hoursMonday;
        else if (dow === 2) baseHours = person.hoursTuesday;
        else if (dow === 3) baseHours = person.hoursWednesday;
        else if (dow === 4) baseHours = person.hoursThursday;
        else if (dow === 5) baseHours = person.hoursFriday;

        if (baseHours === 0 || holidayDates.has(dateStr)) {
          row[dateStr] = '-';
          continue;
        }

        // Check absence
        const absence = personAbsences.find(a => {
          const s = format(new Date(a.startDate), 'yyyy-MM-dd');
          const e = format(new Date(a.endDate), 'yyyy-MM-dd');
          return dateStr >= s && dateStr <= e;
        });

        if (absence && !absence.isHalfDay) {
          row[dateStr] = absence.absenceType.name;
          continue;
        }

        const absHours = absence && absence.isHalfDay ? baseHours / 2 : 0;
        const available = baseHours - absHours;
        totalAvailable += available;

        // Get allocation
        const pct = personAllocations
          .filter(a => {
            const s = format(new Date(a.startDate), 'yyyy-MM-dd');
            const e = format(new Date(a.endDate), 'yyyy-MM-dd');
            return dateStr >= s && dateStr <= e;
          })
          .reduce((sum, a) => sum + a.percentage, 0);

        totalAllocated += (pct / 100) * baseHours;
        row[dateStr] = `${pct}%`;
      }

      row['Total Available (h)'] = Math.round(totalAvailable * 10) / 10;
      row['Total Allocated (h)'] = Math.round(totalAllocated * 10) / 10;
      row['Utilization %'] = totalAvailable > 0
        ? Math.round((totalAllocated / totalAvailable) * 100 * 10) / 10
        : 0;

      rows.push(row);
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Utilization');

    if (exportFormat === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=utilization_${startDate}_${endDate}.csv`);
      res.send(csv);
    } else {
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=utilization_${startDate}_${endDate}.xlsx`);
      res.send(buffer);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
