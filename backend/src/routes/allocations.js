const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireEditor } = require('../middleware/auth');
const { startOfWeek, endOfWeek } = require('date-fns');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/allocations
router.get('/', async (req, res) => {
  try {
    const { personId, projectId, startDate, endDate } = req.query;
    const where = {};
    if (personId) where.personId = personId;
    if (projectId) where.projectId = projectId;
    if (startDate || endDate) {
      where.OR = [
        {
          startDate: { lte: endDate ? new Date(endDate) : undefined },
          endDate: { gte: startDate ? new Date(startDate) : undefined },
        },
      ];
    }

    const allocations = await prisma.allocation.findMany({
      where,
      include: {
        person: { include: { role: true, team: true } },
        project: true,
      },
      orderBy: { startDate: 'asc' },
    });
    res.json(allocations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/allocations/week - Set allocation for entire week
router.post('/week', requireEditor, async (req, res) => {
  try {
    const { personId, projectId, percentage, weekDate } = req.body;
    // weekDate is any date in the target week
    const date = new Date(weekDate);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    // Check for existing allocation for this person+project overlapping this week
    const existing = await prisma.allocation.findFirst({
      where: {
        personId,
        projectId,
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
      },
    });

    let allocation;
    if (existing) {
      // Update existing
      allocation = await prisma.allocation.update({
        where: { id: existing.id },
        data: {
          percentage: parseFloat(percentage),
          startDate: weekStart < new Date(existing.startDate) ? weekStart : existing.startDate,
          endDate: weekEnd > new Date(existing.endDate) ? weekEnd : existing.endDate,
        },
        include: { person: { include: { role: true } }, project: true },
      });
    } else {
      // Create new for the week
      allocation = await prisma.allocation.create({
        data: {
          personId,
          projectId,
          percentage: parseFloat(percentage),
          startDate: weekStart,
          endDate: weekEnd,
        },
        include: { person: { include: { role: true } }, project: true },
      });
    }

    res.status(201).json(allocation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/allocations
router.post('/', requireEditor, async (req, res) => {
  try {
    const { personId, projectId, percentage, startDate, endDate, notes } = req.body;
    
    const allocation = await prisma.allocation.create({
      data: {
        personId,
        projectId,
        percentage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes,
      },
      include: { person: { include: { role: true } }, project: true },
    });
    res.status(201).json(allocation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/allocations/:id
router.put('/:id', requireEditor, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);

    const allocation = await prisma.allocation.update({
      where: { id: req.params.id },
      data,
      include: { person: { include: { role: true } }, project: true },
    });
    res.json(allocation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/allocations/:id
router.delete('/:id', requireEditor, async (req, res) => {
  try {
    await prisma.allocation.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/allocations/bulk - Save multiple allocations + absence in one request
router.post('/bulk', requireEditor, async (req, res) => {
  try {
    const { personId, allocations = [], absence } = req.body;
    if (!personId) return res.status(400).json({ error: 'personId is required' });

    const results = [];

    // Process allocations
    for (const alloc of allocations) {
      if (!alloc.projectId || !alloc.percentage) continue;
      if (alloc.id) {
        // Update existing
        const updated = await prisma.allocation.update({
          where: { id: alloc.id },
          data: {
            percentage: parseFloat(alloc.percentage),
            startDate: new Date(alloc.startDate),
            endDate: new Date(alloc.endDate),
          },
        });
        results.push(updated);
      } else {
        // Create new
        const created = await prisma.allocation.create({
          data: {
            personId,
            projectId: alloc.projectId,
            percentage: parseFloat(alloc.percentage),
            startDate: new Date(alloc.startDate),
            endDate: new Date(alloc.endDate),
          },
        });
        results.push(created);
      }
    }

    // Process absence
    if (absence?.absenceTypeId) {
      await prisma.absence.create({
        data: {
          personId,
          absenceTypeId: absence.absenceTypeId,
          startDate: new Date(absence.startDate),
          endDate: new Date(absence.endDate),
          isHalfDay: absence.isHalfDay || false,
        },
      });
    }

    res.status(201).json({ saved: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
