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
      jiraApiToken: config.jiraApiToken ? '••••••••' + config.jiraApiToken.slice(-4) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tempo/config - Create or update Tempo config
router.post('/config', requireAdmin, async (req, res) => {
  try {
    const { baseUrl, apiToken, jiraBaseUrl, jiraEmail, jiraApiToken } = req.body;

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
        jiraEmail: jiraEmail || null,
        jiraApiToken: jiraApiToken || null,
        isActive: true,
      },
    });

    res.status(201).json({
      ...config,
      apiToken: '••••••••' + config.apiToken.slice(-4),
      jiraApiToken: config.jiraApiToken ? '••••••••' + config.jiraApiToken.slice(-4) : null,
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

// In-memory background sync job. A sync fetches from Tempo + Jira and can run longer
// than the gateway timeout, so we run it detached and let the client poll for status.
// Single backend instance => module-level state is fine; it resets on process restart.
let syncJob = { status: 'idle', startedAt: null, finishedAt: null, params: null, result: null, error: null, message: null };

function buildSyncMessage(result) {
  return `Synced ${result.synced} worklogs, ${result.skipped || 0} unchanged, ${result.deleted || 0} removed, ${result.unmatched} unmatched`;
}

// POST /api/tempo/sync - Kick off a background worklog sync. Returns 202 immediately.
// body: { from, to, personId?, teamId? }
router.post('/sync', requireEditor, async (req, res) => {
  try {
    const { from, to, personId, teamId } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required (YYYY-MM-DD)' });
    }

    if (syncJob.status === 'running') {
      return res.status(409).json({ error: 'A sync is already running', job: syncJob });
    }

    const service = await TempoService.getConfig();
    if (!service) {
      return res.status(400).json({ error: 'Tempo integration not configured. Add API token in Settings.' });
    }

    syncJob = {
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      params: { from, to, personId: personId || null, teamId: teamId || null },
      result: null,
      error: null,
      message: 'Sync running…',
    };

    // Run detached — do NOT await, so the request returns immediately and can't time out.
    service.syncWorklogs(from, to, { personId, teamId })
      .then((result) => {
        syncJob = { ...syncJob, status: 'done', finishedAt: new Date().toISOString(), result, message: buildSyncMessage(result) };
      })
      .catch((err) => {
        console.error('Tempo sync failed:', err);
        syncJob = { ...syncJob, status: 'error', finishedAt: new Date().toISOString(), error: err.message, message: `Sync failed: ${err.message}` };
      });

    res.status(202).json({ status: 'running', message: 'Sync started', job: syncJob });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tempo/sync/status - Poll the background sync job state.
router.get('/sync/status', requireEditor, (req, res) => {
  res.json(syncJob);
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
