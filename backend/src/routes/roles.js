const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/roles
router.get('/', async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { people: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/roles
router.post('/', async (req, res) => {
  try {
    const role = await prisma.role.create({ data: req.body });
    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/roles/:id
router.put('/:id', async (req, res) => {
  try {
    const role = await prisma.role.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/roles/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.role.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
