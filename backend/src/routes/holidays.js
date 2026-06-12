const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { getAustrianHolidays } = require('../utils/holidays');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/holidays?year=2026
router.get('/', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const holidays = await prisma.publicHoliday.findMany({
      where: {
        date: { gte: startOfYear, lte: endOfYear },
      },
      orderBy: { date: 'asc' },
    });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/holidays/generate?year=2026 - Generate holidays for a year
router.post('/generate', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const holidays = getAustrianHolidays(year);

    const created = [];
    for (const holiday of holidays) {
      const h = await prisma.publicHoliday.upsert({
        where: { date: holiday.date },
        update: { name: holiday.name },
        create: {
          name: holiday.name,
          date: holiday.date,
          isHalfDay: holiday.isHalfDay,
        },
      });
      created.push(h);
    }

    res.json({ message: `Generated ${created.length} holidays for ${year}`, holidays: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/holidays - Add custom holiday
router.post('/', async (req, res) => {
  try {
    const holiday = await prisma.publicHoliday.create({
      data: {
        name: req.body.name,
        date: new Date(req.body.date),
        isHalfDay: req.body.isHalfDay || false,
      },
    });
    res.status(201).json(holiday);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/holidays/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.publicHoliday.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
