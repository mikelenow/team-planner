const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, SVG, and WebP files are allowed'));
    }
  },
});

router.use(authenticate);

/**
 * Parse the `codes` field (additional project codes) from a request body.
 * Accepts a JSON array or a comma/newline-separated string. Trims, drops
 * blanks, removes the primary code, and de-duplicates (case-insensitive).
 * Returns `undefined` when the field is absent (so it isn't touched on update).
 */
function parseCodes(raw, primaryCode) {
  if (raw === undefined || raw === null) return undefined;
  const arr = Array.isArray(raw) ? raw : String(raw).split(/[,\n]/);
  const primary = (primaryCode || '').trim().toUpperCase();
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const code = String(item).trim();
    if (!code) continue;
    const upper = code.toUpperCase();
    if (upper === primary || seen.has(upper)) continue;
    seen.add(upper);
    out.push(code);
  }
  return out;
}

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const projects = await prisma.project.findMany({
      where,
      include: {
        _count: { select: { allocations: true } },
        codes: { select: { id: true, code: true }, orderBy: { code: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        codes: { select: { id: true, code: true }, orderBy: { code: 'asc' } },
        allocations: {
          include: { person: { include: { role: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', upload.single('logo'), async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      code: req.body.code,
      color: req.body.color || null,
      description: req.body.description || null,
      jiraProjectKey: req.body.jiraProjectKey || null,
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
    };
    if (req.file) {
      data.logo = req.file.filename;
    }

    const codes = parseCodes(req.body.codes, req.body.code);

    const project = await prisma.project.create({
      data: {
        ...data,
        ...(codes ? { codes: { create: codes.map(c => ({ code: c })) } } : {}),
      },
      include: { codes: { select: { id: true, code: true } } },
    });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id
router.put('/:id', upload.single('logo'), async (req, res) => {
  try {
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.code !== undefined) data.code = req.body.code;
    if (req.body.color !== undefined) data.color = req.body.color || null;
    if (req.body.description !== undefined) data.description = req.body.description || null;
    if (req.body.jiraProjectKey !== undefined) data.jiraProjectKey = req.body.jiraProjectKey || null;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    if (req.body.startDate !== undefined) data.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
    if (req.body.endDate !== undefined) data.endDate = req.body.endDate ? new Date(req.body.endDate) : null;

    if (req.file) {
      // Delete old logo if exists
      const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (existing?.logo) {
        const oldPath = path.join(__dirname, '../../uploads/logos', existing.logo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      data.logo = req.file.filename;
    }

    // Handle explicit logo removal
    if (req.body.removeLogo === 'true') {
      const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (existing?.logo) {
        const oldPath = path.join(__dirname, '../../uploads/logos', existing.logo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      data.logo = null;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
    });

    // Sync additional codes if provided
    const codes = parseCodes(req.body.codes, project.code);
    if (codes !== undefined) {
      // Delete existing codes and re-create
      await prisma.projectCode.deleteMany({ where: { projectId: req.params.id } });
      if (codes.length > 0) {
        await prisma.projectCode.createMany({
          data: codes.map(c => ({ projectId: req.params.id, code: c })),
        });
      }
    }

    const updated = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { codes: { select: { id: true, code: true } } },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (project?.logo) {
      const logoPath = path.join(__dirname, '../../uploads/logos', project.logo);
      if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
    }
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
