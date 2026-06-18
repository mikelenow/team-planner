const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireEditor } = require('../middleware/auth');
const { startOfWeek } = require('date-fns');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Normalise any date to the Monday (UTC midnight) of its week.
function normalizeWeekStart(date) {
  const monday = startOfWeek(new Date(date), { weekStartsOn: 1 });
  return new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
}

const HOUR_FIELDS = ['hoursMonday', 'hoursTuesday', 'hoursWednesday', 'hoursThursday', 'hoursFriday'];

// GET /api/schedules?personId=...&from=...&to=...
// Returns the weekly schedule overrides for a person (optionally within a range).
router.get('/', async (req, res) => {
  try {
    const { personId, from, to } = req.query;
    if (!personId) return res.status(400).json({ error: 'personId is required' });

    const where = { personId };
    if (from || to) {
      where.weekStart = {};
      if (from) where.weekStart.gte = normalizeWeekStart(from);
      if (to) where.weekStart.lte = new Date(to);
    }

    const schedules = await prisma.weeklySchedule.findMany({
      where,
      orderBy: { weekStart: 'asc' },
    });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedules  — upsert a week override (by personId + weekStart)
// body: { personId, weekStart, hoursMonday, hoursTuesday, ... }
router.post('/', requireEditor, async (req, res) => {
  try {
    const { personId, weekStart } = req.body;
    if (!personId || !weekStart) {
      return res.status(400).json({ error: 'personId and weekStart are required' });
    }

    const normalized = normalizeWeekStart(weekStart);
    const data = { personId, weekStart: normalized };
    for (const f of HOUR_FIELDS) {
      data[f] = req.body[f] != null ? parseFloat(req.body[f]) : 0;
    }

    const schedule = await prisma.weeklySchedule.upsert({
      where: { personId_weekStart: { personId, weekStart: normalized } },
      update: HOUR_FIELDS.reduce((acc, f) => ({ ...acc, [f]: data[f] }), {}),
      create: data,
    });
    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedules?personId=...&weekStart=...  — reset a week to the person default
router.delete('/', requireEditor, async (req, res) => {
  try {
    const { personId, weekStart } = req.query;
    if (!personId || !weekStart) {
      return res.status(400).json({ error: 'personId and weekStart are required' });
    }
    await prisma.weeklySchedule.deleteMany({
      where: { personId, weekStart: normalizeWeekStart(weekStart) },
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
