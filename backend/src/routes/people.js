const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireEditor } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/people
router.get('/', async (req, res) => {
  try {
    const { teamId, roleId, isActive } = req.query;
    const where = {};
    if (teamId) where.teamId = teamId;
    if (roleId) where.roleId = roleId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const people = await prisma.person.findMany({
      where,
      include: { role: true, team: true },
      orderBy: { lastName: 'asc' },
    });
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/people/:id
router.get('/:id', async (req, res) => {
  try {
    const person = await prisma.person.findUnique({
      where: { id: req.params.id },
      include: {
        role: true,
        team: true,
        allocations: { include: { project: true }, orderBy: { startDate: 'desc' } },
        absences: { include: { absenceType: true }, orderBy: { startDate: 'desc' } },
      },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/people
router.post('/', requireEditor, async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.email) data.email = null;
    if (!data.teamId) data.teamId = null;
    const person = await prisma.person.create({
      data,
      include: { role: true, team: true },
    });
    res.status(201).json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/people/:id
router.put('/:id', requireEditor, async (req, res) => {
  try {
    const data = { ...req.body };
    if ('email' in data && !data.email) data.email = null;
    if ('teamId' in data && !data.teamId) data.teamId = null;
    const person = await prisma.person.update({
      where: { id: req.params.id },
      data,
      include: { role: true, team: true },
    });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/people/:id
router.delete('/:id', requireEditor, async (req, res) => {
  try {
    await prisma.person.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
