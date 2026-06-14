const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireEditor } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/absences
router.get('/', async (req, res) => {
  try {
    const { personId, startDate, endDate } = req.query;
    const where = {};
    if (personId) where.personId = personId;
    if (startDate && endDate) {
      where.startDate = { lte: new Date(endDate) };
      where.endDate = { gte: new Date(startDate) };
    }

    const absences = await prisma.absence.findMany({
      where,
      include: { person: true, absenceType: true },
      orderBy: { startDate: 'asc' },
    });
    res.json(absences);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/absences/types
router.get('/types', async (req, res) => {
  try {
    const types = await prisma.absenceType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/absences/types
router.post('/types', requireEditor, async (req, res) => {
  try {
    const type = await prisma.absenceType.create({ data: req.body });
    res.status(201).json(type);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/absences
router.post('/', requireEditor, async (req, res) => {
  try {
    const { personId, absenceTypeId, startDate, endDate, isHalfDay, notes } = req.body;
    const absence = await prisma.absence.create({
      data: {
        personId,
        absenceTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isHalfDay: isHalfDay || false,
        notes,
      },
      include: { person: true, absenceType: true },
    });
    res.status(201).json(absence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/absences/:id
router.put('/:id', requireEditor, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);

    const absence = await prisma.absence.update({
      where: { id: req.params.id },
      data,
      include: { person: true, absenceType: true },
    });
    res.json(absence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/absences/:id
router.delete('/:id', requireEditor, async (req, res) => {
  try {
    await prisma.absence.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
