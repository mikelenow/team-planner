/**
 * Tempo.io API Service
 * Handles fetching worklogs from Tempo Cloud or Server.
 * 
 * Tempo Cloud API v4: https://apidocs.tempo.io/
 * Tempo Server (Data Center): https://tempo-io.github.io/tempo-api-docs/
 * 
 * This service abstracts the difference — set baseUrl accordingly:
 *   - Cloud: https://api.tempo.io/4
 *   - Server: https://your-jira.com/rest/tempo-timesheets/4
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class TempoService {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.apiToken = config.apiToken;
    this.jiraBaseUrl = config.jiraBaseUrl;
  }

  /**
   * Get active Tempo configuration from database
   */
  static async getConfig() {
    const config = await prisma.tempoConfig.findFirst({
      where: { isActive: true },
    });
    if (!config) return null;
    return new TempoService(config);
  }

  /**
   * Make authenticated request to Tempo API
   */
  async request(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Tempo API error ${response.status}: ${body}`);
    }

    return response.json();
  }

  /**
   * Fetch worklogs for a date range.
   * Handles pagination automatically.
   * 
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @param {string} [accountId] - Optional: filter by Jira account ID
   * @param {string} [projectKey] - Optional: filter by Jira project key
   */
  async fetchWorklogs({ from, to, accountId, projectKey }) {
    const allWorklogs = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      let endpoint;
      let params;

      if (accountId) {
        // Fetch by user
        endpoint = `/worklogs/user/${accountId}`;
        params = { from, to, offset, limit };
      } else if (projectKey) {
        // Fetch by project
        endpoint = `/worklogs/project/${projectKey}`;
        params = { from, to, offset, limit };
      } else {
        // Fetch all
        endpoint = '/worklogs';
        params = { from, to, offset, limit };
      }

      const data = await this.request(endpoint, params);
      const results = data.results || data.worklogs || [];
      allWorklogs.push(...results);

      // Check pagination
      if (results.length < limit) break;
      offset += limit;
    }

    return allWorklogs;
  }

  /**
   * Sync worklogs from Tempo to local database.
   * Matches worklogs to people and projects by email/accountId and project key.
   * 
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   */
  async syncWorklogs(from, to) {
    const worklogs = await this.fetchWorklogs({ from, to });

    // Get all people and projects for matching
    const people = await prisma.person.findMany({
      where: { isActive: true },
      select: { id: true, email: true, jiraAccountId: true, jiraEmail: true },
    });
    const projects = await prisma.project.findMany({
      select: { id: true, code: true, jiraProjectKey: true },
    });

    // Build lookup maps
    const personByAccountId = new Map();
    const personByEmail = new Map();
    people.forEach(p => {
      if (p.jiraAccountId) personByAccountId.set(p.jiraAccountId, p.id);
      if (p.jiraEmail) personByEmail.set(p.jiraEmail.toLowerCase(), p.id);
      if (p.email) personByEmail.set(p.email.toLowerCase(), p.id);
    });

    const projectByKey = new Map();
    projects.forEach(p => {
      if (p.jiraProjectKey) projectByKey.set(p.jiraProjectKey.toUpperCase(), p.id);
      if (p.code) projectByKey.set(p.code.toUpperCase(), p.id);
    });

    // Upsert worklogs
    let synced = 0;
    let unmatched = 0;

    for (const wl of worklogs) {
      const tempoWorklogId = wl.tempoWorklogId || wl.id;
      const jiraAccountId = wl.author?.accountId || wl.worker || '';
      const jiraIssueKey = wl.issue?.key || wl.issueKey || '';
      const jiraProjectKey = jiraIssueKey.split('-')[0] || '';
      const date = wl.startDate || wl.dateStarted?.split('T')[0] || '';
      const timeSpentHours = (wl.timeSpentSeconds || wl.timeSpent || 0) / 3600;
      const description = wl.description || '';

      // Match person
      let personId = personByAccountId.get(jiraAccountId) || null;
      if (!personId && wl.author?.emailAddress) {
        personId = personByEmail.get(wl.author.emailAddress.toLowerCase()) || null;
      }

      // Match project
      const projectId = projectByKey.get(jiraProjectKey.toUpperCase()) || null;

      if (!personId && !projectId) {
        unmatched++;
      }

      await prisma.tempoWorklog.upsert({
        where: { tempoWorklogId },
        update: {
          jiraAccountId,
          jiraProjectKey,
          jiraIssueKey,
          description,
          date: new Date(date),
          timeSpentHours,
          personId,
          projectId,
        },
        create: {
          tempoWorklogId,
          jiraAccountId,
          jiraProjectKey,
          jiraIssueKey,
          description,
          date: new Date(date),
          timeSpentHours,
          personId,
          projectId,
        },
      });

      synced++;
    }

    // Update last sync time
    await prisma.tempoConfig.updateMany({
      where: { isActive: true },
      data: { lastSyncAt: new Date() },
    });

    return { synced, unmatched, total: worklogs.length };
  }

  /**
   * Get "Planned vs Actual" report for a date range.
   * Compares team-planner allocations with Tempo worklogs.
   */
  static async getPlannedVsActual(from, to, { personId, projectId } = {}) {
    // Get planned data (allocations)
    const allocationWhere = {
      startDate: { lte: new Date(to) },
      endDate: { gte: new Date(from) },
    };
    if (personId) allocationWhere.personId = personId;
    if (projectId) allocationWhere.projectId = projectId;

    const allocations = await prisma.allocation.findMany({
      where: allocationWhere,
      include: {
        person: { include: { role: true } },
        project: true,
      },
    });

    // Get actual data (tempo worklogs)
    const worklogWhere = {
      date: { gte: new Date(from), lte: new Date(to) },
    };
    if (personId) worklogWhere.personId = personId;
    if (projectId) worklogWhere.projectId = projectId;

    const worklogs = await prisma.tempoWorklog.findMany({
      where: worklogWhere,
    });

    // Get people with their working hours for planned calculation
    const personWhere = { isActive: true };
    if (personId) personWhere.id = personId;

    const people = await prisma.person.findMany({
      where: personWhere,
      include: { role: true, team: true },
    });

    // Calculate planned hours per person per project
    const { eachDayOfInterval, getDay, format } = require('date-fns');
    const days = eachDayOfInterval({ start: new Date(from), end: new Date(to) });

    const holidays = await prisma.publicHoliday.findMany({
      where: { date: { gte: new Date(from), lte: new Date(to) } },
    });
    const holidayDates = new Set(holidays.map(h => format(new Date(h.date), 'yyyy-MM-dd')));

    const report = [];

    for (const person of people) {
      // Calculate working days and hours in period
      let totalWorkingHours = 0;
      for (const day of days) {
        const dow = getDay(day);
        const dateStr = format(day, 'yyyy-MM-dd');
        if (dow === 0 || dow === 6) continue; // weekend
        if (holidayDates.has(dateStr)) continue; // holiday

        const dayHours = [0, person.hoursMonday, person.hoursTuesday, person.hoursWednesday, person.hoursThursday, person.hoursFriday, 0][dow];
        totalWorkingHours += dayHours;
      }

      // Get this person's allocations
      const personAllocations = allocations.filter(a => a.personId === person.id);
      const personWorklogs = worklogs.filter(w => w.personId === person.id);

      // Group by project
      const projectMap = new Map();

      // Planned hours from allocations
      personAllocations.forEach(alloc => {
        const key = alloc.projectId;
        if (!projectMap.has(key)) {
          projectMap.set(key, {
            projectId: alloc.projectId,
            projectName: alloc.project.name,
            projectCode: alloc.project.code,
            projectColor: alloc.project.color,
            plannedHours: 0,
            actualHours: 0,
          });
        }
        const entry = projectMap.get(key);
        entry.plannedHours += (alloc.percentage / 100) * totalWorkingHours;
      });

      // Actual hours from worklogs
      personWorklogs.forEach(wl => {
        const key = wl.projectId || `unmatched-${wl.jiraProjectKey}`;
        if (!projectMap.has(key)) {
          projectMap.set(key, {
            projectId: wl.projectId,
            projectName: wl.jiraProjectKey || 'Unmatched',
            projectCode: wl.jiraProjectKey || '?',
            projectColor: null,
            plannedHours: 0,
            actualHours: 0,
          });
        }
        projectMap.get(key).actualHours += wl.timeSpentHours;
      });

      const projects = Array.from(projectMap.values()).map(p => ({
        ...p,
        plannedHours: Math.round(p.plannedHours * 10) / 10,
        actualHours: Math.round(p.actualHours * 10) / 10,
        diffHours: Math.round((p.actualHours - p.plannedHours) * 10) / 10,
        diffPercent: p.plannedHours > 0
          ? Math.round(((p.actualHours - p.plannedHours) / p.plannedHours) * 100)
          : (p.actualHours > 0 ? 100 : 0),
      }));

      const totalPlanned = projects.reduce((s, p) => s + p.plannedHours, 0);
      const totalActual = projects.reduce((s, p) => s + p.actualHours, 0);

      report.push({
        person: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          role: person.role,
          team: person.team,
        },
        totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,
        totalPlanned: Math.round(totalPlanned * 10) / 10,
        totalActual: Math.round(totalActual * 10) / 10,
        totalDiff: Math.round((totalActual - totalPlanned) * 10) / 10,
        projects,
      });
    }

    return report;
  }
}

module.exports = TempoService;
