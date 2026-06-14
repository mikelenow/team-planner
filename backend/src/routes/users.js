const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/users - List all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - Create user (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role: role || 'VIEWER' },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, role, isActive, password } = req.body;
    const data = {};

    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.password = await bcrypt.hash(password, 10);

    // Prevent removing last admin
    if (role && role !== 'ADMIN') {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (user?.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last admin' });
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Prevent removing last admin
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (user?.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin' });
      }
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
