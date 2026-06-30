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
    this.jiraEmail = config.jiraEmail;
    this.jiraApiToken = config.jiraApiToken;
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
   * Fetch Jira user details by account ID (with DB cache).
   */
  async fetchJiraUser(accountId) {
    if (!this.jiraBaseUrl || !this.jiraEmail || !this.jiraApiToken) return null;

    // Check cache first
    const cacheKey = `user:${accountId}`;
    const cached = await prisma.jiraCache.findUnique({ where: { key: cacheKey } }).catch(() => null);
    if (cached) return JSON.parse(cached.data);

    try {
      const url = `${this.jiraBaseUrl}/rest/api/3/user?accountId=${encodeURIComponent(accountId)}`;
      const auth = Buffer.from(`${this.jiraEmail}:${this.jiraApiToken}`).toString('base64');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      const result = {
        accountId: data.accountId,
        displayName: data.displayName || '',
        emailAddress: data.emailAddress || '',
      };
      // Cache it
      await prisma.jiraCache.upsert({
        where: { key: cacheKey },
        update: { data: JSON.stringify(result) },
        create: { key: cacheKey, type: 'user', data: JSON.stringify(result) },
      }).catch(() => {});
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Fetch Jira user details for multiple account IDs.
   * Uses cache + parallel requests (batches of 10).
   */
  async fetchJiraUsers(accountIds) {
    const users = new Map();
    const uncached = [];

    // Check cache for all IDs
    const cacheKeys = accountIds.filter(Boolean).map(id => `user:${id}`);
    if (cacheKeys.length > 0) {
      const cachedRows = await prisma.jiraCache.findMany({
        where: { key: { in: cacheKeys } },
      });
      for (const row of cachedRows) {
        const id = row.key.replace('user:', '');
        users.set(id, JSON.parse(row.data));
      }
    }

    // Find uncached IDs
    for (const id of accountIds) {
      if (id && !users.has(id)) uncached.push(id);
    }

    // Fetch uncached in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < uncached.length; i += batchSize) {
      const batch = uncached.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(id => this.fetchJiraUser(id))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          users.set(batch[idx], r.value);
        }
      });
    }
    return users;
  }

  /**
   * Fetch Jira issue key by issue ID.
   * Returns the issue key (e.g. "AMA-103") or null.
   */
  async fetchJiraIssueKey(issueId) {
    if (!this.jiraBaseUrl || !this.jiraEmail || !this.jiraApiToken) return null;
    try {
      const url = `${this.jiraBaseUrl}/rest/api/3/issue/${issueId}?fields=key`;
      const auth = Buffer.from(`${this.jiraEmail}:${this.jiraApiToken}`).toString('base64');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.key || null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch Jira issue keys for multiple issue IDs using JQL bulk search.
   * Uses DB cache for known issues. Returns Map<issueId, issueKey>.
   */
  async fetchJiraIssueKeys(issueIds) {
    const keys = new Map();
    if (!this.jiraBaseUrl || !this.jiraEmail || !this.jiraApiToken || issueIds.length === 0) return keys;
    this._jiraErrors = this._jiraErrors || [];

    // Check cache first
    const stringIds = issueIds.filter(Boolean).map(String);
    const cacheKeys = stringIds.map(id => `issue:${id}`);
    if (cacheKeys.length > 0) {
      const cachedRows = await prisma.jiraCache.findMany({ where: { key: { in: cacheKeys } } });
      for (const row of cachedRows) {
        const id = row.key.replace('issue:', '');
        keys.set(id, JSON.parse(row.data).key);
      }
    }

    // Find uncached IDs
    const uncachedIds = stringIds.filter(id => !keys.has(id));
    if (uncachedIds.length === 0) return keys;

    const auth = Buffer.from(`${this.jiraEmail}:${this.jiraApiToken}`).toString('base64');

    // Fetch uncached in batches of 100 via JQL
    const batchSize = 100;
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);
      try {
        const jql = `id in (${batch.join(',')})`;
        const url = `${this.jiraBaseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key&maxResults=${batchSize}`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          const errText = await response.text();
          this._jiraErrors.push(`Batch ${i}: ${response.status} - ${errText.slice(0, 200)}`);
          continue;
        }
        const data = await response.json();
        const cacheOps = [];
        for (const issue of (data.issues || [])) {
          const id = String(issue.id);
          keys.set(id, issue.key);
          cacheOps.push(prisma.jiraCache.upsert({
            where: { key: `issue:${id}` },
            update: { data: JSON.stringify({ key: issue.key }) },
            create: { key: `issue:${id}`, type: 'issue', data: JSON.stringify({ key: issue.key }) },
          }));
        }
        if (cacheOps.length > 0) await prisma.$transaction(cacheOps).catch(() => {});
      } catch (err) {
        this._jiraErrors.push(`Batch ${i}: ${err.message}`);
      }
    }
    return keys;
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
  async syncWorklogs(from, to, { personId, teamId } = {}) {
    // Determine which account IDs to sync
    let accountIdsToSync = null; // null = sync all
    if (personId || teamId) {
      const personWhere = { isActive: true };
      if (personId) personWhere.id = personId;
      if (teamId) personWhere.teamId = teamId;
      const targetPeople = await prisma.person.findMany({
        where: personWhere,
        select: { jiraAccountId: true, firstName: true, lastName: true },
      });
      accountIdsToSync = targetPeople.map(p => p.jiraAccountId).filter(Boolean);
      if (accountIdsToSync.length === 0) {
        return { synced: 0, skipped: 0, unmatched: 0, total: 0, error: 'No Jira account IDs found for selected people. Sync all first to auto-link accounts.' };
      }
    }

    // Fetch worklogs — per-user if filtered, otherwise all
    let worklogs;
    if (accountIdsToSync) {
      worklogs = [];
      for (const accountId of accountIdsToSync) {
        const userLogs = await this.fetchWorklogs({ from, to, accountId });
        worklogs.push(...userLogs);
      }
    } else {
      worklogs = await this.fetchWorklogs({ from, to });
    }

    // Log first worklog to understand Tempo API structure
    if (worklogs.length > 0) {
      console.log('Sample Tempo worklog structure:', JSON.stringify(worklogs[0], null, 2));
    }

    // Collect unique account IDs and fetch their Jira profiles
    const uniqueAccountIds = [...new Set(worklogs.map(wl => wl.author?.accountId || wl.worker).filter(Boolean))];
    const jiraUsers = await this.fetchJiraUsers(uniqueAccountIds);
    console.log(`Fetched ${jiraUsers.size} Jira user profiles for ${uniqueAccountIds.length} account IDs`);

    // Collect unique issue IDs and fetch their keys from Jira
    const uniqueIssueIds = [...new Set(worklogs.map(wl => wl.issue?.id).filter(Boolean))];
    const jiraIssueKeys = await this.fetchJiraIssueKeys(uniqueIssueIds);
    console.log(`Fetched ${jiraIssueKeys.size} Jira issue keys for ${uniqueIssueIds.length} issue IDs`);

    // Get all people and projects for matching
    const people = await prisma.person.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, jiraAccountId: true, jiraEmail: true },
    });
    const projects = await prisma.project.findMany({
      select: { id: true, code: true, jiraProjectKey: true, codes: { select: { code: true } } },
    });

    // Normalize name for fuzzy matching (lowercase, remove hyphens/special chars)
    const normalizeName = (name) => name.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

    // Build lookup maps
    const personByAccountId = new Map();
    const personByEmail = new Map();
    const personByName = new Map();
    people.forEach(p => {
      if (p.jiraAccountId) personByAccountId.set(p.jiraAccountId, p.id);
      if (p.jiraEmail) personByEmail.set(p.jiraEmail.toLowerCase(), p.id);
      if (p.email) personByEmail.set(p.email.toLowerCase(), p.id);
      // Name-based matching (fallback) — multiple variants
      const fullName = normalizeName(`${p.firstName} ${p.lastName}`);
      const reversedName = normalizeName(`${p.lastName} ${p.firstName}`);
      if (fullName) personByName.set(fullName, p.id);
      if (reversedName) personByName.set(reversedName, p.id);
    });

    const projectByKey = new Map();
    projects.forEach(p => {
      if (p.jiraProjectKey) projectByKey.set(p.jiraProjectKey.toUpperCase(), p.id);
      if (p.code) projectByKey.set(p.code.toUpperCase(), p.id);
      // Additional codes
      if (p.codes) p.codes.forEach(c => projectByKey.set(c.code.toUpperCase(), p.id));
    });

    // Pre-fetch existing worklogs for this period to detect changes
    const existingWorklogs = await prisma.tempoWorklog.findMany({
      where: { date: { gte: new Date(from), lte: new Date(to) } },
      select: { tempoWorklogId: true, jiraAccountId: true, timeSpentHours: true, personId: true, projectId: true, date: true, jiraIssueKey: true, description: true },
    });
    const existingByTempoId = new Map(existingWorklogs.map(w => [w.tempoWorklogId, w]));

    // Match worklogs and collect the ones that need writing — skip unchanged ones.
    // The DB writes are executed afterwards in parallel batches (one round-trip per
    // worklog, run serially, is the main reason a large sync times out the gateway).
    let skipped = 0;
    let unmatched = 0;
    const personUpdates = new Map(); // jiraAccountId -> personId (for batch update)
    const toWrite = []; // worklog payloads to upsert

    for (const wl of worklogs) {
      const tempoWorklogId = wl.tempoWorklogId || wl.id;
      const jiraAccountId = wl.author?.accountId || wl.worker || '';
      const jiraIssueId = wl.issue?.id ? String(wl.issue.id) : '';
      const jiraIssueKey = wl.issue?.key || jiraIssueKeys.get(jiraIssueId) || wl.issueKey || '';
      const jiraProjectKey = jiraIssueKey.split('-')[0] || '';
      const date = wl.startDate || wl.dateStarted?.split('T')[0] || '';
      const dateObj = new Date(date);
      const timeSpentHours = (wl.timeSpentSeconds || wl.timeSpent || 0) / 3600;
      const description = wl.description || '';

      // Skip malformed worklogs with no usable date (would corrupt the date column).
      if (isNaN(dateObj.getTime())) {
        continue;
      }

      // Get Jira user info for this worklog's author
      const jiraUser = jiraUsers.get(jiraAccountId);
      const jiraDisplayName = jiraUser?.displayName || wl.author?.displayName || '';
      const jiraEmailAddr = jiraUser?.emailAddress || wl.author?.emailAddress || '';

      // Match person (try accountId -> jira email -> person email -> display name)
      let personId = personByAccountId.get(jiraAccountId) || null;
      if (!personId && jiraEmailAddr) {
        personId = personByEmail.get(jiraEmailAddr.toLowerCase()) || null;
      }
      if (!personId && jiraDisplayName) {
        personId = personByName.get(normalizeName(jiraDisplayName)) || null;
      }

      // Queue jiraAccountId auto-populate
      if (personId && jiraAccountId && !personByAccountId.has(jiraAccountId)) {
        personByAccountId.set(jiraAccountId, personId);
        personUpdates.set(jiraAccountId, personId);
      }

      // Match project
      const projectId = projectByKey.get(jiraProjectKey.toUpperCase()) || null;

      if (!personId && !projectId) {
        unmatched++;
      }

      // Skip if worklog exists and nothing relevant changed. Compare hours (with an
      // epsilon, since they're floats), person/project links, and the fields that a Tempo
      // edit can move: date, issue, and description.
      const existing = existingByTempoId.get(tempoWorklogId);
      if (existing
          && Math.abs(existing.timeSpentHours - timeSpentHours) < 0.0001
          && existing.personId === personId && existing.projectId === projectId
          && existing.date.getTime() === dateObj.getTime()
          && (existing.jiraIssueKey || '') === jiraIssueKey
          && (existing.description || '') === description) {
        skipped++;
        continue;
      }

      toWrite.push({
        tempoWorklogId,
        jiraAccountId,
        jiraDisplayName,
        jiraIssueId,
        jiraProjectKey,
        jiraIssueKey,
        description,
        date: dateObj,
        timeSpentHours,
        personId,
        projectId,
      });
    }

    // Execute the upserts in parallel batches to keep the request well under the gateway timeout.
    const BATCH = 25;
    for (let i = 0; i < toWrite.length; i += BATCH) {
      await Promise.all(toWrite.slice(i, i + BATCH).map(({ tempoWorklogId, ...data }) =>
        prisma.tempoWorklog.upsert({
          where: { tempoWorklogId },
          update: data,
          create: { tempoWorklogId, ...data },
        })
      ));
    }
    const synced = toWrite.length;

    // Batch update person jiraAccountIds (small list — only newly linked accounts).
    await Promise.all(Array.from(personUpdates, ([accountId, personId]) =>
      prisma.person.update({ where: { id: personId }, data: { jiraAccountId: accountId } }).catch(() => {})
    ));

    // Reconcile deletions: remove local worklogs in this period that no longer exist in
    // Tempo (deleted or moved out of range). fetchWorklogs throws on API errors, so an
    // empty fetch genuinely means "no worklogs here", not a failed request.
    // We already have the period's existing rows in memory, so compute the small set of
    // ids that vanished and delete those by id (cheap) rather than a giant NOT IN list.
    // When scoped to specific people/teams, only reconcile those accounts so we never
    // touch worklogs the current run didn't fetch.
    const fetchedIds = new Set(worklogs.map(wl => wl.tempoWorklogId || wl.id).filter(Boolean));
    const scopedAccounts = accountIdsToSync ? new Set(accountIdsToSync) : null;
    const idsToDelete = existingWorklogs
      .filter(w => !fetchedIds.has(w.tempoWorklogId))
      .filter(w => !scopedAccounts || scopedAccounts.has(w.jiraAccountId))
      .map(w => w.tempoWorklogId);
    let deleted = 0;
    if (idsToDelete.length > 0) {
      ({ count: deleted } = await prisma.tempoWorklog.deleteMany({ where: { tempoWorklogId: { in: idsToDelete } } }));
    }

    // Update last sync time
    await prisma.tempoConfig.updateMany({
      where: { isActive: true },
      data: { lastSyncAt: new Date() },
    });

    return {
      synced,
      skipped,
      deleted,
      unmatched,
      total: worklogs.length,
      jiraUsersResolved: jiraUsers.size,
      jiraIssueKeysResolved: jiraIssueKeys.size,
      uniqueIssueIds: uniqueIssueIds.length,
      jiraErrors: this._jiraErrors || [],
      sampleRaw: worklogs.length > 0 ? JSON.parse(JSON.stringify(worklogs[0])) : null,
    };
  }

  /**
   * Re-match existing unmatched worklogs to people/projects.
   * Useful after adding people or fixing names.
   */
  async rematchWorklogs() {
    const normalizeName = (name) => name.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

    const people = await prisma.person.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, jiraAccountId: true, jiraEmail: true },
    });
    const projects = await prisma.project.findMany({
      select: { id: true, code: true, jiraProjectKey: true, codes: { select: { code: true } } },
    });

    // Build lookup maps
    const personByAccountId = new Map();
    const personByEmail = new Map();
    const personByName = new Map();
    people.forEach(p => {
      if (p.jiraAccountId) personByAccountId.set(p.jiraAccountId, p.id);
      if (p.jiraEmail) personByEmail.set(p.jiraEmail.toLowerCase(), p.id);
      if (p.email) personByEmail.set(p.email.toLowerCase(), p.id);
      const fullName = normalizeName(`${p.firstName} ${p.lastName}`);
      const reversedName = normalizeName(`${p.lastName} ${p.firstName}`);
      if (fullName) personByName.set(fullName, p.id);
      if (reversedName) personByName.set(reversedName, p.id);
    });

    const projectByKey = new Map();
    projects.forEach(p => {
      if (p.jiraProjectKey) projectByKey.set(p.jiraProjectKey.toUpperCase(), p.id);
      if (p.code) projectByKey.set(p.code.toUpperCase(), p.id);
      if (p.codes) p.codes.forEach(c => projectByKey.set(c.code.toUpperCase(), p.id));
    });

    // Get all unmatched worklogs
    const unmatchedWorklogs = await prisma.tempoWorklog.findMany({
      where: {
        OR: [{ personId: null }, { projectId: null }],
      },
    });

    // Fetch Jira user profiles for unmatched account IDs
    const unmatchedAccountIds = [...new Set(unmatchedWorklogs.filter(w => !w.personId && w.jiraAccountId).map(w => w.jiraAccountId))];
    const jiraUsers = await this.fetchJiraUsers(unmatchedAccountIds);
    console.log(`Rematch: fetched ${jiraUsers.size} Jira profiles for ${unmatchedAccountIds.length} unmatched accounts`);

    // Fetch Jira issue keys for worklogs with empty project key
    const issueIdsToLookup = [...new Set(unmatchedWorklogs.filter(w => !w.projectId && !w.jiraProjectKey && w.jiraIssueId).map(w => w.jiraIssueId))];
    const jiraIssueKeys = await this.fetchJiraIssueKeys(issueIdsToLookup);
    console.log(`Rematch: fetched ${jiraIssueKeys.size} Jira issue keys for ${issueIdsToLookup.length} issues`);

    let matched = 0;
    for (const wl of unmatchedWorklogs) {
      let personId = wl.personId;
      let projectId = wl.projectId;

      if (!personId) {
        personId = personByAccountId.get(wl.jiraAccountId) || null;

        // Try Jira email
        if (!personId) {
          const jiraUser = jiraUsers.get(wl.jiraAccountId);
          if (jiraUser?.emailAddress) {
            personId = personByEmail.get(jiraUser.emailAddress.toLowerCase()) || null;
          }
          // Try Jira display name
          if (!personId && jiraUser?.displayName) {
            personId = personByName.get(normalizeName(jiraUser.displayName)) || null;
          }
          // Update stored display name
          if (jiraUser?.displayName && jiraUser.displayName !== wl.jiraDisplayName) {
            await prisma.tempoWorklog.update({ where: { id: wl.id }, data: { jiraDisplayName: jiraUser.displayName } }).catch(() => {});
          }
        }

        // Fallback to stored display name
        if (!personId && wl.jiraDisplayName) {
          personId = personByName.get(normalizeName(wl.jiraDisplayName)) || null;
        }
      }

      if (!projectId) {
        let projectKey = wl.jiraProjectKey;
        // If no project key stored, look it up from Jira issue ID
        if (!projectKey && wl.jiraIssueId) {
          const issueKey = jiraIssueKeys.get(wl.jiraIssueId);
          if (issueKey) {
            projectKey = issueKey.split('-')[0];
            // Update the stored keys on this worklog
            await prisma.tempoWorklog.update({
              where: { id: wl.id },
              data: { jiraIssueKey: issueKey, jiraProjectKey: projectKey },
            }).catch(() => {});
          }
        }
        if (projectKey) {
          projectId = projectByKey.get(projectKey.toUpperCase()) || null;
        }
      }

      if (personId !== wl.personId || projectId !== wl.projectId) {
        await prisma.tempoWorklog.update({
          where: { id: wl.id },
          data: { personId, projectId },
        });
        matched++;

        // Auto-save jiraAccountId
        if (personId && wl.jiraAccountId && !personByAccountId.has(wl.jiraAccountId)) {
          personByAccountId.set(wl.jiraAccountId, personId);
          await prisma.person.update({
            where: { id: personId },
            data: { jiraAccountId: wl.jiraAccountId },
          }).catch(() => {});
        }
      }
    }

    return { matched, total: unmatchedWorklogs.length, debug: {
      peopleCount: people.length,
      projectsCount: projects.length,
      projectKeys: Array.from(projectByKey.keys()),
      sampleWorklogs: unmatchedWorklogs.slice(0, 5).map(w => ({
        jiraProjectKey: w.jiraProjectKey,
        jiraAccountId: w.jiraAccountId,
        jiraDisplayName: w.jiraDisplayName,
        personId: w.personId,
        projectId: w.projectId,
      })),
    } };
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
    const { eachDayOfInterval, format, startOfWeek } = require('date-fns');
    const { buildScheduleLookup, getDailyHours } = require('../utils/workingHours');
    const days = eachDayOfInterval({ start: new Date(from), end: new Date(to) });

    const holidays = await prisma.publicHoliday.findMany({
      where: { date: { gte: new Date(from), lte: new Date(to) } },
    });
    const holidayDates = new Set(holidays.map(h => format(new Date(h.date), 'yyyy-MM-dd')));

    const schedules = await prisma.weeklySchedule.findMany({
      where: {
        personId: { in: people.map(p => p.id) },
        weekStart: { gte: startOfWeek(new Date(from), { weekStartsOn: 1 }), lte: new Date(to) },
      },
    });
    const scheduleLookup = buildScheduleLookup(schedules);

    const periodStart = new Date(from);
    const periodEnd = new Date(to);

    // Sum a person's working hours over an inclusive [start, end] window, skipping holidays
    // and honouring per-week schedule overrides (0 on weekends/off days).
    const workingHoursBetween = (person, start, end) => {
      if (end < start) return 0;
      let hours = 0;
      for (const day of eachDayOfInterval({ start, end })) {
        if (holidayDates.has(format(day, 'yyyy-MM-dd'))) continue;
        hours += getDailyHours(person, day, scheduleLookup);
      }
      return hours;
    };

    const report = [];

    for (const person of people) {
      // Calculate working days and hours in period
      let totalWorkingHours = 0;
      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (holidayDates.has(dateStr)) continue; // holiday

        // honours per-week schedule overrides; returns 0 on weekends/off days
        totalWorkingHours += getDailyHours(person, day, scheduleLookup);
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
        // Only count working hours within the allocation's overlap with the report period —
        // an allocation shorter than the window must not be credited the whole period.
        const start = new Date(alloc.startDate) > periodStart ? new Date(alloc.startDate) : periodStart;
        const end = new Date(alloc.endDate) < periodEnd ? new Date(alloc.endDate) : periodEnd;
        entry.plannedHours += (alloc.percentage / 100) * workingHoursBetween(person, start, end);
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
