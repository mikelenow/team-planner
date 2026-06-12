const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/teams
router.get('/', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      include: { _count: { select: { people: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams
router.post('/', async (req, res) => {
  try {
    const team = await prisma.team.create({ data: req.body });
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teams/:id
router.put('/:id', async (req, res) => {
  try {
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.team.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
