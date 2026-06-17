const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, requireEditor } = require('../middleware/auth');
const TempoService = require('../services/tempo');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

// ─── Config Management (Admin only) ─────────────────────────────────────────

// GET /api/tempo/config
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const config = await prisma.tempoConfig.findFirst({ where: { isActive: true } });
    if (!config) return res.json(null);
    // Don't send full token to frontend
    res.json({
      ...config,
      apiToken: config.apiToken ? '••••••••' + config.apiToken.slice(-4) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tempo/config - Create or update Tempo config
router.post('/config', requireAdmin, async (req, res) => {
  try {
    const { baseUrl, apiToken, jiraBaseUrl } = req.body;

    // Deactivate existing configs
    await prisma.tempoConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const config = await prisma.tempoConfig.create({
      data: {
        baseUrl: baseUrl || 'https://api.tempo.io/4',
        apiToken,
        jiraBaseUrl: jiraBaseUrl || null,
        isActive: true,
      },
    });

    res.status(201).json({
      ...config,
      apiToken: '••••••••' + config.apiToken.slice(-4),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tempo/config
router.delete('/config', requireAdmin, async (req, res) => {
  try {
    await prisma.tempoConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync ────────────────────────────────────────────────────────────────────

// POST /api/tempo/sync - Fetch worklogs from Tempo
router.post('/sync', requireEditor, async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required (YYYY-MM-DD)' });
    }

    const service = await TempoService.getConfig();
    if (!service) {
      return res.status(400).json({ error: 'Tempo integration not configured. Add API token in Settings.' });
    }

    const result = await service.syncWorklogs(from, to);
    res.json({
      message: `Synced ${result.synced} worklogs (${result.unmatched} unmatched)`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tempo/rematch - Re-match existing worklogs to people/projects
router.post('/rematch', requireEditor, async (req, res) => {
  try {
    const service = await TempoService.getConfig();
    if (!service) {
      return res.status(400).json({ error: 'Tempo integration not configured.' });
    }

    const result = await service.rematchWorklogs();
    res.json({
      message: `Re-matched ${result.matched} of ${result.total} previously unmatched worklogs`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Planned vs Actual Report ────────────────────────────────────────────────

// GET /api/tempo/report?from=2026-06-01&to=2026-06-30&personId=...&projectId=...
router.get('/report', async (req, res) => {
  try {
    const { from, to, personId, projectId } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required' });
    }

    const report = await TempoService.getPlannedVsActual(from, to, { personId, projectId });
    res.json({
      period: { from, to },
      report,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Worklog data ────────────────────────────────────────────────────────────

// GET /api/tempo/worklogs?from=...&to=...&personId=...&projectId=...
router.get('/worklogs', async (req, res) => {
  try {
    const { from, to, personId, projectId } = req.query;
    const where = {};
    if (from && to) {
      where.date = { gte: new Date(from), lte: new Date(to) };
    }
    if (personId) where.personId = personId;
    if (projectId) where.projectId = projectId;

    const worklogs = await prisma.tempoWorklog.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    });
    res.json(worklogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tempo/unmatched - Worklogs that couldn't be matched to people/projects
router.get('/unmatched', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {
      OR: [{ personId: null }, { projectId: null }],
    };
    if (from && to) {
      where.date = { gte: new Date(from), lte: new Date(to) };
    }
    const unmatched = await prisma.tempoWorklog.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200,
    });

    // Group by jiraAccountId to show unique unmatched authors
    const authorMap = new Map();
    unmatched.forEach(w => {
      const key = w.jiraAccountId || 'unknown';
      if (!authorMap.has(key)) {
        authorMap.set(key, { jiraAccountId: w.jiraAccountId, displayName: w.jiraDisplayName || '', count: 0, totalHours: 0, sampleIssues: [] });
      }
      const entry = authorMap.get(key);
      entry.count++;
      entry.totalHours += w.timeSpentHours;
      if (!entry.displayName && w.jiraDisplayName) entry.displayName = w.jiraDisplayName;
      if (entry.sampleIssues.length < 3) entry.sampleIssues.push(w.jiraIssueKey);
    });

    res.json({
      total: unmatched.length,
      byAuthor: Array.from(authorMap.values()),
      worklogs: unmatched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
