import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

export default function TempoPage() {
  const { isAdmin } = useAuth();
  const [report, setReport] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [unmatched, setUnmatched] = useState(null);
  const [sampleRaw, setSampleRaw] = useState(null);
  const [syncStats, setSyncStats] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [period, setPeriod] = useState('month'); // week | month | custom
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [configForm, setConfigForm] = useState({
    baseUrl: 'https://api.tempo.io/4',
    apiToken: '',
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
  });

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const res = await api.get('/tempo/config');
      setConfig(res.data);
    } catch (err) {
      // Not configured yet
    }
  };

  const getDateRange = () => {
    const now = new Date();
    if (period === 'week') {
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    } else if (period === 'month') {
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    }
    return { from: customFrom, to: customTo };
  };

  const handleSync = async () => {
    const { from, to } = getDateRange();
    if (!from || !to) {
      toast.error('Select a date range first');
      return;
    }
    setSyncing(true);
    try {
      const res = await api.post('/tempo/sync', { from, to });
      toast.success(res.data.message);
      setSyncStats({
        synced: res.data.synced,
        unmatched: res.data.unmatched,
        total: res.data.total,
        jiraUsersResolved: res.data.jiraUsersResolved,
        jiraIssueKeysResolved: res.data.jiraIssueKeysResolved,
        uniqueIssueIds: res.data.uniqueIssueIds,
        jiraErrors: res.data.jiraErrors,
      });
      if (res.data.sampleRaw) {
        setSampleRaw(res.data.sampleRaw);
      }
      loadReport();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleRematch = async () => {
    setRematching(true);
    try {
      const res = await api.post('/tempo/rematch');
      toast.success(res.data.message);
      if (res.data.debug) {
        console.log('Rematch debug:', JSON.stringify(res.data.debug, null, 2));
        setUnmatched(prev => ({ ...prev, debug: res.data.debug }));
      }
      loadReport();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rematch failed');
    } finally {
      setRematching(false);
    }
  };

  const loadUnmatched = async () => {
    const { from, to } = getDateRange();
    try {
      const res = await api.get(`/tempo/unmatched?from=${from}&to=${to}`);
      setUnmatched(res.data);
    } catch (err) {
      toast.error('Failed to load unmatched worklogs');
    }
  };

  const loadReport = async () => {
    const { from, to } = getDateRange();
    if (!from || !to) return;
    setLoading(true);
    try {
      const res = await api.get(`/tempo/report?from=${from}&to=${to}`);
      setReport(res.data.report || []);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tempo/config', configForm);
      toast.success('Tempo configuration saved');
      setShowConfigModal(false);
      loadConfig();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save config');
    }
  };

  const getDiffColor = (diff) => {
    if (diff === 0) return 'text-gray-500';
    if (diff > 0) return 'text-red-600'; // over actual
    return 'text-green-600'; // under actual (capacity remaining)
  };

  const getDiffBg = (diffPercent) => {
    if (Math.abs(diffPercent) <= 10) return 'bg-green-50';
    if (Math.abs(diffPercent) <= 25) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const { from, to } = getDateRange();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planned vs Actual</h1>
          <p className="text-sm text-gray-500 mt-1">Compare planned allocations with Tempo worklogs</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowConfigModal(true)} className="btn-secondary text-sm">
              ⚙️ Configure
            </button>
          )}
        </div>
      </div>

      {/* Config status */}
      {!config && (
        <div className="card mb-6 bg-yellow-50 border-yellow-200">
          <p className="text-sm text-yellow-800">
            ⚠️ Tempo integration not configured.{' '}
            {isAdmin ? (
              <button onClick={() => setShowConfigModal(true)} className="font-medium underline">Set up now</button>
            ) : 'Ask an admin to configure it in Settings.'}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[{ key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }].map(v => (
            <button
              key={v.key}
              onClick={() => setPeriod(v.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${period === v.key ? 'bg-white shadow-sm font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className="input w-36 text-sm" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-gray-400">→</span>
            <input type="date" className="input w-36 text-sm" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={syncing || !config}
          className="btn-primary text-sm"
        >
          {syncing ? '⏳ Syncing...' : '🔄 Sync from Tempo'}
        </button>

        <button onClick={loadReport} className="btn-secondary text-sm">
          📊 Load Report
        </button>

        <button
          onClick={handleRematch}
          disabled={rematching}
          className="btn-secondary text-sm"
        >
          {rematching ? '⏳ Rematching...' : '🔗 Rematch'}
        </button>

        <button onClick={loadUnmatched} className="btn-secondary text-sm">
          ❓ Unmatched
        </button>

        {from && to && (
          <span className="text-xs text-gray-500">{from} → {to}</span>
        )}
      </div>

      {/* Report */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
      ) : report.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <p>No data yet. Click "Sync from Tempo" to fetch worklogs, then "Load Report".</p>
        </div>
      ) : (
        <div className="space-y-4">
          {report.map((item) => (
            <div key={item.person.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.person.firstName} {item.person.lastName}</h3>
                  <span className="text-xs text-gray-500">{item.person.role?.name}{item.person.team ? ` • ${item.person.team.name}` : ''}</span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">Capacity: <strong>{item.totalWorkingHours}h</strong></span>
                    <span className="text-blue-600">Planned: <strong>{item.totalPlanned}h</strong></span>
                    <span className="text-purple-600">Actual: <strong>{item.totalActual}h</strong></span>
                    <span className={`font-bold ${getDiffColor(item.totalDiff)}`}>
                      {item.totalDiff > 0 ? '+' : ''}{item.totalDiff}h
                    </span>
                  </div>
                </div>
              </div>

              {item.projects.length > 0 && (
                <div className="border-t pt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left py-1">Project</th>
                        <th className="text-right py-1">Planned</th>
                        <th className="text-right py-1">Actual</th>
                        <th className="text-right py-1">Diff</th>
                        <th className="text-right py-1">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.projects.map((proj, idx) => (
                        <tr key={idx} className={`${getDiffBg(proj.diffPercent)} rounded`}>
                          <td className="py-1.5 flex items-center gap-2">
                            {proj.projectColor && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: proj.projectColor }}></div>}
                            <span className="font-medium">{proj.projectName}</span>
                            <span className="text-xs text-gray-400">{proj.projectCode}</span>
                          </td>
                          <td className="text-right py-1.5 text-blue-600">{proj.plannedHours}h</td>
                          <td className="text-right py-1.5 text-purple-600">{proj.actualHours}h</td>
                          <td className={`text-right py-1.5 font-medium ${getDiffColor(proj.diffHours)}`}>
                            {proj.diffHours > 0 ? '+' : ''}{proj.diffHours}h
                          </td>
                          <td className={`text-right py-1.5 text-xs ${getDiffColor(proj.diffPercent)}`}>
                            {proj.diffPercent > 0 ? '+' : ''}{proj.diffPercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raw Tempo API sample (debug) */}
      {sampleRaw && (
        <div className="card mt-6 bg-gray-50 border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-700">🔍 Raw Tempo API Response (1st worklog)</h3>
            <button onClick={() => setSampleRaw(null)} className="text-sm text-gray-500 hover:text-gray-700">✕ Close</button>
          </div>
          <pre className="text-xs font-mono bg-white p-3 rounded border overflow-auto max-h-80">{JSON.stringify(sampleRaw, null, 2)}</pre>
        </div>
      )}

      {/* Unmatched Section */}
      {unmatched && (
        <div className="card mt-6 bg-orange-50 border-orange-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-orange-900">⚠️ Unmatched Worklogs ({unmatched.total})</h3>
            <button onClick={() => setUnmatched(null)} className="text-sm text-gray-500 hover:text-gray-700">✕ Close</button>
          </div>
          {unmatched.byAuthor && unmatched.byAuthor.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b">
                  <th className="text-left py-1">Jira Account ID</th>
                  <th className="text-left py-1">Display Name</th>
                  <th className="text-right py-1">Worklogs</th>
                  <th className="text-right py-1">Hours</th>
                  <th className="text-left py-1">Sample Issues</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.byAuthor.map((a, i) => (
                  <tr key={i} className="border-b border-orange-100">
                    <td className="py-1.5 font-mono text-xs">{a.jiraAccountId || '-'}</td>
                    <td className="py-1.5">{a.displayName || '-'}</td>
                    <td className="text-right py-1.5">{a.count}</td>
                    <td className="text-right py-1.5 font-medium">{Math.round(a.totalHours * 10) / 10}h</td>
                    <td className="py-1.5 text-xs text-gray-500">{a.sampleIssues?.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-green-800">✅ All worklogs are matched!</p>
          )}
          {unmatched.debug && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-60">
              <p className="font-bold mb-1">Debug Info:</p>
              <p>People in DB: {unmatched.debug.peopleCount}</p>
              <p>Projects in DB: {unmatched.debug.projectsCount}</p>
              <p>Project keys in lookup: {unmatched.debug.projectKeys?.join(', ') || 'none'}</p>
              <p className="mt-2 font-bold">Sample unmatched worklogs:</p>
              {unmatched.debug.sampleWorklogs?.map((w, i) => (
                <p key={i}>#{i+1}: projectKey="{w.jiraProjectKey}" displayName="{w.jiraDisplayName}" personId={w.personId ? 'SET' : 'null'} projectId={w.projectId ? 'SET' : 'null'}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config Modal */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Tempo Integration Setup">
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="label">Tempo API Base URL *</label>
            <select className="input" value={configForm.baseUrl} onChange={(e) => setConfigForm(f => ({...f, baseUrl: e.target.value}))}>
              <option value="https://api.tempo.io/4">Tempo Cloud (api.tempo.io/4)</option>
              <option value="custom">Custom (Tempo Server / Data Center)</option>
            </select>
            {configForm.baseUrl === 'custom' && (
              <input className="input mt-2" placeholder="https://your-jira.com/rest/tempo-timesheets/4" onChange={(e) => setConfigForm(f => ({...f, baseUrl: e.target.value}))} />
            )}
          </div>
          <div>
            <label className="label">Tempo API Token *</label>
            <input
              className="input"
              type="password"
              value={configForm.apiToken}
              onChange={(e) => setConfigForm(f => ({...f, apiToken: e.target.value}))}
              required
              placeholder="Get from Tempo → Settings → API Integration"
            />
            <p className="text-xs text-gray-500 mt-1">
              Generate at: Tempo → Settings → API Integration → New Token
            </p>
          </div>
          <div>
            <label className="label">Jira Base URL</label>
            <input
              className="input"
              value={configForm.jiraBaseUrl}
              onChange={(e) => setConfigForm(f => ({...f, jiraBaseUrl: e.target.value}))}
              placeholder="https://yourcompany.atlassian.net"
            />
          </div>
          <div>
            <label className="label">Jira Email (for user lookup)</label>
            <input
              className="input"
              type="email"
              value={configForm.jiraEmail}
              onChange={(e) => setConfigForm(f => ({...f, jiraEmail: e.target.value}))}
              placeholder="your-email@company.com"
            />
            <p className="text-xs text-gray-500 mt-1">Used to fetch display names from Jira for matching</p>
          </div>
          <div>
            <label className="label">Jira API Token</label>
            <input
              className="input"
              type="password"
              value={configForm.jiraApiToken}
              onChange={(e) => setConfigForm(f => ({...f, jiraApiToken: e.target.value}))}
              placeholder="Generate at id.atlassian.com/manage-profile/security/api-tokens"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800 space-y-1">
            <p><strong>How matching works:</strong></p>
            <p>• People are matched by <strong>Jira Account ID</strong>, <strong>email</strong>, or <strong>display name</strong></p>
            <p>• Projects are matched by <strong>Jira Project Key</strong> (set on each project, e.g. "NKD")</p>
            <p>• Jira credentials are needed to look up user names/emails from account IDs</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowConfigModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Configuration</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
