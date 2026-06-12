const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

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

// POST /api/allocations
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
  try {
    await prisma.allocation.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
