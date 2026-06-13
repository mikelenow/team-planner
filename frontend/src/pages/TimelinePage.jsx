import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format, addWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from 'date-fns';
import { getUtilizationBgColor } from '../utils/helpers';
import Modal from '../components/Modal';

export default function TimelinePage() {
  const [utilization, setUtilization] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState({ roleId: '', teamId: '' });

  // Cell editing state
  const [editingCell, setEditingCell] = useState(null); // { personId, date, allocations }
  const [showCellModal, setShowCellModal] = useState(false);
  const [cellAllocations, setCellAllocations] = useState([]); // [{projectId, percentage}]
  const [cellAbsence, setCellAbsence] = useState({ absenceTypeId: '', isHalfDay: false });

  useEffect(() => { loadRolesTeams(); }, []);
  useEffect(() => { loadUtilization(); }, [currentDate, viewMode, filters]);

  const loadRolesTeams = async () => {
    try {
      const [rolesRes, teamsRes, projectsRes, typesRes] = await Promise.all([
        api.get('/roles'),
        api.get('/teams'),
        api.get('/projects?isActive=true'),
        api.get('/absences/types'),
      ]);
      setRoles(rolesRes.data);
      setTeams(teamsRes.data);
      setProjects(projectsRes.data);
      setAbsenceTypes(typesRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const getDateRange = () => {
    let start, end;
    if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else if (viewMode === '2weeks') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }
    return { start, end };
  };

  const loadUtilization = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const params = new URLSearchParams({
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      });
      if (filters.roleId) params.set('roleId', filters.roleId);
      if (filters.teamId) params.set('teamId', filters.teamId);

      const res = await api.get(`/utilization?${params}`);
      setUtilization(res.data.people || []);
    } catch (err) {
      toast.error('Failed to load utilization data');
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction) => {
    if (viewMode === 'week') {
      setCurrentDate(d => addWeeks(d, direction));
    } else if (viewMode === '2weeks') {
      setCurrentDate(d => addWeeks(d, direction * 2));
    } else {
      setCurrentDate(d => {
        const next = new Date(d);
        next.setMonth(next.getMonth() + direction);
        return next;
      });
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleExport = async (exportFormat) => {
    try {
      const { start, end } = getDateRange();
      const res = await api.get(`/export/utilization?startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(end, 'yyyy-MM-dd')}&format=${exportFormat}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `utilization_${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Exported as ${exportFormat.toUpperCase()}`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  // ─── Cell click handler ────────────────────────────────────────────────────

  const handleCellClick = (personItem, dateStr) => {
    const dayData = personItem.daily.find(d => d.date === dateStr);
    if (!dayData || dayData.weekend || dayData.holiday) return;

    // Find active allocations for this person on this date
    const activeAllocations = personItem.allocations
      .filter(a => {
        const start = format(new Date(a.startDate), 'yyyy-MM-dd');
        const end = format(new Date(a.endDate), 'yyyy-MM-dd');
        return dateStr >= start && dateStr <= end;
      })
      .map(a => ({ id: a.id, projectId: a.project.id, projectName: a.project.name, percentage: a.percentage, startDate: a.startDate, endDate: a.endDate }));

    setEditingCell({
      personId: personItem.person.id,
      personName: `${personItem.person.firstName} ${personItem.person.lastName}`,
      date: dateStr,
      dayData,
    });
    setCellAllocations(activeAllocations.length > 0 ? activeAllocations : [{ id: null, projectId: '', percentage: 100, startDate: dateStr, endDate: dateStr }]);
    setCellAbsence({ absenceTypeId: '', isHalfDay: false });
    setShowCellModal(true);
  };

  // ─── Save allocations from cell modal ─────────────────────────────────────

  const handleSaveCellAllocations = async () => {
    try {
      for (const alloc of cellAllocations) {
        if (!alloc.projectId || !alloc.percentage) continue;

        if (alloc.id) {
          // Update existing allocation
          await api.put(`/allocations/${alloc.id}`, {
            percentage: parseFloat(alloc.percentage),
            startDate: alloc.startDate,
            endDate: alloc.endDate,
          });
        } else {
          // Create new allocation
          await api.post('/allocations', {
            personId: editingCell.personId,
            projectId: alloc.projectId,
            percentage: parseFloat(alloc.percentage),
            startDate: alloc.startDate || editingCell.date,
            endDate: alloc.endDate || editingCell.date,
          });
        }
      }

      // Handle absence if set
      if (cellAbsence.absenceTypeId) {
        await api.post('/absences', {
          personId: editingCell.personId,
          absenceTypeId: cellAbsence.absenceTypeId,
          startDate: editingCell.date,
          endDate: editingCell.date,
          isHalfDay: cellAbsence.isHalfDay,
        });
      }

      toast.success('Saved');
      setShowCellModal(false);
      loadUtilization();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDeleteAllocation = async (allocId) => {
    if (!allocId) return;
    try {
      await api.delete(`/allocations/${allocId}`);
      setCellAllocations(prev => prev.filter(a => a.id !== allocId));
      toast.success('Allocation removed');
      loadUtilization();
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  const addAllocationRow = () => {
    setCellAllocations(prev => [...prev, { id: null, projectId: '', percentage: 100, startDate: editingCell.date, endDate: editingCell.date }]);
  };

  const updateAllocationRow = (index, field, value) => {
    setCellAllocations(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const { start, end } = getDateRange();
  const days = eachDayOfInterval({ start, end });
  const workDays = days.filter(d => getDay(d) !== 0 && getDay(d) !== 6);
  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', ''];

  const totalAllocationPct = cellAllocations.reduce((sum, a) => sum + (parseFloat(a.percentage) || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('xlsx')} className="btn-secondary text-sm">📥 XLSX</button>
          <button onClick={() => handleExport('csv')} className="btn-secondary text-sm">📥 CSV</button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateDate(-1)} className="btn-secondary text-sm px-3">←</button>
          <button onClick={goToToday} className="btn-secondary text-sm">Today</button>
          <button onClick={() => navigateDate(1)} className="btn-secondary text-sm px-3">→</button>
        </div>

        <span className="font-medium text-gray-700">
          {format(start, 'dd MMM')} – {format(end, 'dd MMM yyyy')}
        </span>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[{ key: 'week', label: 'Week' }, { key: '2weeks', label: '2 Weeks' }, { key: 'month', label: 'Month' }].map(v => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === v.key ? 'bg-white shadow-sm font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <select className="input w-40 text-sm" value={filters.roleId} onChange={(e) => setFilters(f => ({...f, roleId: e.target.value}))}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <select className="input w-40 text-sm" value={filters.teamId} onChange={(e) => setFilters(f => ({...f, teamId: e.target.value}))}>
          <option value="">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded" style={{ backgroundColor: '#dbeafe' }}></span> 0–50%</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded" style={{ backgroundColor: '#d1fae5' }}></span> 51–80%</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded" style={{ backgroundColor: '#fef3c7' }}></span> 81–100%</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded" style={{ backgroundColor: '#fee2e2' }}></span> Over 100%</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-gray-300"></span> Holiday/Absence</span>
        <span className="text-gray-400 ml-2">💡 Click any cell to edit</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b min-w-[200px]">
                  Person
                </th>
                {workDays.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={`px-1 py-3 text-center text-xs font-medium border-b min-w-[60px] ${isToday(day) ? 'bg-primary-50' : ''}`}
                  >
                    <div className="text-gray-500">{dayNames[getDay(day)]}</div>
                    <div className={`${isToday(day) ? 'text-primary-600 font-bold' : 'text-gray-700'}`}>{format(day, 'dd')}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b min-w-[80px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {utilization.map((item) => (
                <tr key={item.person.id} className="border-b hover:bg-gray-50/50">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2 border-r">
                    <div className="font-medium text-sm text-gray-900">{item.person.firstName} {item.person.lastName}</div>
                    <div className="text-xs text-gray-500">{item.person.role?.shortName || item.person.role?.name}{item.person.team ? ` • ${item.person.team.name}` : ''}</div>
                  </td>
                  {workDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayData = item.daily.find(d => d.date === dateStr);

                    if (!dayData || dayData.weekend) return <td key={dateStr} className="px-1 py-2"></td>;

                    if (dayData.holiday) {
                      return (
                        <td key={dateStr} className="px-1 py-2 text-center" title={dayData.holidayName}>
                          <div className="h-8 flex items-center justify-center rounded bg-purple-100 text-purple-700 text-xs font-medium">
                            🎉
                          </div>
                        </td>
                      );
                    }

                    if (dayData.absenceType && dayData.available === 0) {
                      return (
                        <td key={dateStr} className="px-1 py-2 text-center" title={dayData.absenceType}>
                          <div
                            className="h-8 flex items-center justify-center rounded bg-gray-200 text-gray-600 text-xs cursor-pointer hover:ring-2 hover:ring-primary-300"
                            onClick={() => handleCellClick(item, dateStr)}
                          >
                            {dayData.absenceType.slice(0, 3)}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={dateStr} className={`px-1 py-2 text-center ${isToday(day) ? 'bg-primary-50/50' : ''}`}>
                        <div
                          className="h-8 flex items-center justify-center rounded text-xs font-medium cursor-pointer hover:ring-2 hover:ring-primary-300 transition-shadow"
                          style={{ backgroundColor: getUtilizationBgColor(dayData.allocationPct) }}
                          title={`${dayData.allocationPct}% allocated (${dayData.allocated}h / ${dayData.available}h available) — Click to edit`}
                          onClick={() => handleCellClick(item, dateStr)}
                        >
                          {dayData.allocationPct > 0 ? `${dayData.allocationPct}%` : ''}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-center border-l">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                      item.summary.utilization > 100 ? 'bg-red-100 text-red-700' :
                      item.summary.utilization > 80 ? 'bg-yellow-100 text-yellow-700' :
                      item.summary.utilization > 50 ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.summary.utilization}%
                      {item.summary.overallocated && ' ⚠️'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {utilization.length === 0 && <p className="text-center text-gray-500 py-8">No data to display.</p>}
        </div>
      )}

      {/* ─── Cell Edit Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={showCellModal} onClose={() => setShowCellModal(false)} title={`Edit — ${editingCell?.personName}`} size="lg">
        <div className="mb-4">
          <span className="text-sm text-gray-500">
            📅 {editingCell?.date} • Available: {editingCell?.dayData?.available}h
          </span>
        </div>

        {/* Allocations */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm text-gray-700">Project Allocations</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${totalAllocationPct > 100 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                Total: {totalAllocationPct}%{totalAllocationPct > 100 && ' ⚠️'}
              </span>
              <button onClick={addAllocationRow} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                + Add Project
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {cellAllocations.map((alloc, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  className="input flex-1 text-sm"
                  value={alloc.projectId}
                  onChange={(e) => updateAllocationRow(idx, 'projectId', e.target.value)}
                >
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
                <div className="relative w-20">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input text-sm pr-6"
                    value={alloc.percentage}
                    onChange={(e) => updateAllocationRow(idx, 'percentage', e.target.value)}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
                <input
                  type="date"
                  className="input text-sm w-36"
                  value={alloc.startDate?.split('T')[0] || alloc.startDate || ''}
                  onChange={(e) => updateAllocationRow(idx, 'startDate', e.target.value)}
                  title="Start date"
                />
                <input
                  type="date"
                  className="input text-sm w-36"
                  value={alloc.endDate?.split('T')[0] || alloc.endDate || ''}
                  onChange={(e) => updateAllocationRow(idx, 'endDate', e.target.value)}
                  title="End date"
                />
                {alloc.id ? (
                  <button onClick={() => handleDeleteAllocation(alloc.id)} className="text-red-500 hover:text-red-700 text-sm px-1" title="Delete allocation">✕</button>
                ) : (
                  <button onClick={() => setCellAllocations(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-gray-600 text-sm px-1" title="Remove row">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick absence */}
        <div className="mb-6 pt-4 border-t">
          <h3 className="font-medium text-sm text-gray-700 mb-3">Add Absence (for this day)</h3>
          <div className="flex items-center gap-3">
            <select
              className="input flex-1 text-sm"
              value={cellAbsence.absenceTypeId}
              onChange={(e) => setCellAbsence(prev => ({ ...prev, absenceTypeId: e.target.value }))}
            >
              <option value="">No absence</option>
              {absenceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={cellAbsence.isHalfDay}
                onChange={(e) => setCellAbsence(prev => ({ ...prev, isHalfDay: e.target.checked }))}
                className="rounded"
              />
              Half day
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button onClick={() => setShowCellModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSaveCellAllocations} className="btn-primary">Save Changes</button>
        </div>
      </Modal>
    </div>
  );
}
