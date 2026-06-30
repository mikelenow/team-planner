import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format, addWeeks, addDays, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from 'date-fns';
import { getUtilizationBgColor } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

export default function TimelinePage() {
  const { isEditor } = useAuth();
  const [utilization, setUtilization] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState({ roleId: '', teamId: '' });
  const [showActuals, setShowActuals] = useState(false);

  // Cell editing state
  const [editingCell, setEditingCell] = useState(null);
  const [showCellModal, setShowCellModal] = useState(false);
  const [cellAllocations, setCellAllocations] = useState([]);
  const [cellAbsence, setCellAbsence] = useState({ absenceTypeId: '', isHalfDay: false, startDate: '', endDate: '' });

  // Week editing state
  const [showWeekModal, setShowWeekModal] = useState(false);
  const [weekEditPerson, setWeekEditPerson] = useState(null);
  const [weekAllocations, setWeekAllocations] = useState([]);

  // Weekly working-hours override state
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [hoursEditPerson, setHoursEditPerson] = useState(null);
  const [hoursForm, setHoursForm] = useState({ hoursMonday: 0, hoursTuesday: 0, hoursWednesday: 0, hoursThursday: 0, hoursFriday: 0 });
  const [hoursHasOverride, setHoursHasOverride] = useState(false);

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

  const loadUtilization = async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) toast.error('Failed to load utilization data');
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
    if (!isEditor) return;
    const dayData = personItem.daily.find(d => d.date === dateStr);
    if (!dayData || dayData.weekend || dayData.holiday) return;

    const activeAllocations = personItem.allocations
      .filter(a => {
        const start = format(new Date(a.startDate), 'yyyy-MM-dd');
        const end = format(new Date(a.endDate), 'yyyy-MM-dd');
        return dateStr >= start && dateStr <= end;
      })
      .map(a => ({
        id: a.id, projectId: a.project.id, projectName: a.project.name, percentage: a.percentage, startDate: a.startDate, endDate: a.endDate,
        // Snapshot of the record as loaded, so save can detect a project change and split safely
        origProjectId: a.project.id, origPercentage: a.percentage, origStartDate: a.startDate, origEndDate: a.endDate,
      }));

    setEditingCell({
      personId: personItem.person.id,
      personName: `${personItem.person.firstName} ${personItem.person.lastName}`,
      date: dateStr,
      dayData,
    });
    setCellAllocations(activeAllocations.length > 0 ? activeAllocations : [{ id: null, projectId: '', percentage: 100, startDate: dateStr, endDate: dateStr }]);
    setCellAbsence({ absenceTypeId: '', isHalfDay: false, startDate: dateStr, endDate: dateStr });
    setShowCellModal(true);
  };

  // ─── Week edit handler ─────────────────────────────────────────────────────

  const handleWeekEdit = (personItem) => {
    if (!isEditor) return;
    const { start, end } = getDateRange();
    const weekStart = format(startOfWeek(start, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(start, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    // Collect unique projects allocated this week
    const existingAllocations = personItem.allocations
      .filter(a => {
        const aStart = format(new Date(a.startDate), 'yyyy-MM-dd');
        const aEnd = format(new Date(a.endDate), 'yyyy-MM-dd');
        return aEnd >= weekStart && aStart <= weekEnd;
      })
      .map(a => ({ id: a.id, projectId: a.project.id, projectName: a.project.name, percentage: a.percentage }));

    // Deduplicate by project
    const uniqueMap = new Map();
    existingAllocations.forEach(a => {
      if (!uniqueMap.has(a.projectId) || uniqueMap.get(a.projectId).percentage < a.percentage) {
        uniqueMap.set(a.projectId, a);
      }
    });

    const allocations = Array.from(uniqueMap.values());

    setWeekEditPerson({
      id: personItem.person.id,
      name: `${personItem.person.firstName} ${personItem.person.lastName}`,
      weekStart,
      weekEnd,
    });
    setWeekAllocations(allocations.length > 0 ? allocations : [{ id: null, projectId: '', percentage: 100 }]);
    setShowWeekModal(true);
  };

  const handleSaveWeekAllocations = async () => {
    try {
      for (const alloc of weekAllocations) {
        if (!alloc.projectId || !alloc.percentage) continue;
        await api.post('/allocations/week', {
          personId: weekEditPerson.id,
          projectId: alloc.projectId,
          percentage: parseFloat(alloc.percentage),
          weekDate: weekEditPerson.weekStart,
        });
      }
      toast.success('Week allocations saved');
      setShowWeekModal(false);
      loadUtilization(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  // ─── Weekly working-hours override ─────────────────────────────────────────

  const HOUR_DAYS = [
    ['hoursMonday', 'Mon'], ['hoursTuesday', 'Tue'], ['hoursWednesday', 'Wed'],
    ['hoursThursday', 'Thu'], ['hoursFriday', 'Fri'],
  ];

  const handleHoursEdit = async (personItem) => {
    if (!isEditor) return;
    const { start } = getDateRange();
    const weekStart = format(startOfWeek(start, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(start, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const p = personItem.person;

    // Defaults from the person record (returned by /utilization)
    const defaults = {
      hoursMonday: p.hoursMonday, hoursTuesday: p.hoursTuesday, hoursWednesday: p.hoursWednesday,
      hoursThursday: p.hoursThursday, hoursFriday: p.hoursFriday,
    };

    setHoursEditPerson({ id: p.id, name: `${p.firstName} ${p.lastName}`, weekStart, weekEnd, defaults });

    try {
      const res = await api.get('/schedules', { params: { personId: p.id, from: weekStart, to: weekEnd } });
      const override = res.data.find(s => format(new Date(s.weekStart), 'yyyy-MM-dd') === weekStart);
      if (override) {
        setHoursForm({
          hoursMonday: override.hoursMonday, hoursTuesday: override.hoursTuesday, hoursWednesday: override.hoursWednesday,
          hoursThursday: override.hoursThursday, hoursFriday: override.hoursFriday,
        });
        setHoursHasOverride(true);
      } else {
        setHoursForm(defaults);
        setHoursHasOverride(false);
      }
    } catch (err) {
      setHoursForm(defaults);
      setHoursHasOverride(false);
    }
    setShowHoursModal(true);
  };

  const handleSaveHours = async () => {
    try {
      await api.post('/schedules', {
        personId: hoursEditPerson.id,
        weekStart: hoursEditPerson.weekStart,
        ...Object.fromEntries(HOUR_DAYS.map(([f]) => [f, parseFloat(hoursForm[f]) || 0])),
      });
      toast.success('Weekly hours saved');
      setShowHoursModal(false);
      loadUtilization(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save hours');
    }
  };

  const handleResetHours = async () => {
    try {
      await api.delete('/schedules', { params: { personId: hoursEditPerson.id, weekStart: hoursEditPerson.weekStart } });
      toast.success('Reset to default hours');
      setShowHoursModal(false);
      loadUtilization(true);
    } catch (err) {
      toast.error('Failed to reset');
    }
  };

  const hoursWeekTotal = HOUR_DAYS.reduce((sum, [f]) => sum + (parseFloat(hoursForm[f]) || 0), 0);

  // ─── Save allocations from cell modal ─────────────────────────────────────

  const handleSaveCellAllocations = async () => {
    try {
      const day = (s) => (s || '').split('T')[0];
      const shift = (s, n) => format(addDays(parseISO(day(s)), n), 'yyyy-MM-dd');

      const allocsToSave = [];
      for (const alloc of cellAllocations) {
        if (!alloc.projectId || !alloc.percentage) continue;
        const pct = parseFloat(alloc.percentage);
        const newStart = day(alloc.startDate) || editingCell.date;
        const newEnd = day(alloc.endDate) || editingCell.date;

        const projectChanged = alloc.id && alloc.origProjectId && alloc.projectId !== alloc.origProjectId;
        if (!projectChanged) {
          allocsToSave.push({ id: alloc.id || undefined, projectId: alloc.projectId, percentage: pct, startDate: newStart, endDate: newEnd });
          continue;
        }

        // The project was reassigned on an existing record. The cell modal is day-scoped:
        // if the date range wasn't manually edited, scope the new project to the clicked day
        // only and keep the old project on the surrounding days (split, don't overwrite).
        const oStart = day(alloc.origStartDate);
        const oEnd = day(alloc.origEndDate);
        const datesEdited = newStart !== oStart || newEnd !== oEnd;
        const effStart = datesEdited ? newStart : editingCell.date;
        const effEnd = datesEdited ? newEnd : editingCell.date;

        // Leftover segments of the original range NOT covered by the new project's range.
        const min = (a, b) => (a < b ? a : b);
        const max = (a, b) => (a > b ? a : b);
        const leftovers = [];
        const leftEnd = min(oEnd, shift(effStart, -1));
        if (oStart <= leftEnd) leftovers.push({ start: oStart, end: leftEnd });
        const rightStart = max(oStart, shift(effEnd, 1));
        if (rightStart <= oEnd) leftovers.push({ start: rightStart, end: oEnd });

        if (leftovers.length === 0) {
          // New range fully covers the original — a genuine full reassignment, update in place.
          allocsToSave.push({ id: alloc.id, projectId: alloc.projectId, percentage: pct, startDate: effStart, endDate: effEnd });
        } else {
          // Keep the old project on the leftovers (reuse the original id for the first one),
          // and add a new record for the reassigned days.
          allocsToSave.push({ id: alloc.id, projectId: alloc.origProjectId, percentage: alloc.origPercentage, startDate: leftovers[0].start, endDate: leftovers[0].end });
          for (let i = 1; i < leftovers.length; i++) {
            allocsToSave.push({ projectId: alloc.origProjectId, percentage: alloc.origPercentage, startDate: leftovers[i].start, endDate: leftovers[i].end });
          }
          allocsToSave.push({ projectId: alloc.projectId, percentage: pct, startDate: effStart, endDate: effEnd });
        }
      }

      const absence = cellAbsence.absenceTypeId ? {
        absenceTypeId: cellAbsence.absenceTypeId,
        startDate: cellAbsence.startDate || editingCell.date,
        endDate: cellAbsence.endDate || cellAbsence.startDate || editingCell.date,
        isHalfDay: cellAbsence.isHalfDay,
      } : undefined;

      await api.post('/allocations/bulk', {
        personId: editingCell.personId,
        allocations: allocsToSave,
        absence,
      });

      toast.success('Saved');
      setShowCellModal(false);
      loadUtilization(true);
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
      loadUtilization(true);
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
  const weekTotalPct = weekAllocations.reduce((sum, a) => sum + (parseFloat(a.percentage) || 0), 0);

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

        <button
          onClick={() => setShowActuals(v => !v)}
          className={`text-sm px-3 py-1.5 rounded-md transition-colors ${showActuals ? 'bg-purple-100 text-purple-700 font-medium' : 'bg-gray-100 text-gray-600 hover:text-gray-900'}`}
        >
          ⏱ Actuals
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded" style={{ backgroundColor: '#dbeafe' }}></span> 0–50%</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded" style={{ backgroundColor: '#d1fae5' }}></span> 51–80%</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded" style={{ backgroundColor: '#fef3c7' }}></span> 81–100%</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded" style={{ backgroundColor: '#fee2e2' }}></span> Over 100%</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-gray-300"></span> Holiday/Absence</span>
        {isEditor && <span className="text-gray-400 ml-2">💡 Click any cell to edit • ✏️ bulk-allocate a week • 🕐 set weekly working hours</span>}
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
                {isEditor && (
                  <th className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b min-w-[88px]">
                    Week
                  </th>
                )}
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
                  {isEditor && (
                    <td className="px-1 py-2 text-center">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleWeekEdit(item)}
                          className="h-8 flex-1 flex items-center justify-center rounded bg-primary-50 text-primary-600 text-xs font-medium hover:bg-primary-100 transition-colors"
                          title="Set allocation for entire week"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleHoursEdit(item)}
                          className="h-8 flex-1 flex items-center justify-center rounded bg-amber-50 text-amber-600 text-xs font-medium hover:bg-amber-100 transition-colors"
                          title="Set working hours for this week"
                        >
                          🕐
                        </button>
                      </div>
                    </td>
                  )}
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
                            className={`h-8 flex items-center justify-center rounded bg-gray-200 text-gray-600 text-xs ${isEditor ? 'cursor-pointer hover:ring-2 hover:ring-primary-300' : ''}`}
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
                          className={`${showActuals && dayData.actual > 0 ? 'h-5' : 'h-8'} flex items-center justify-center rounded text-xs font-medium ${isEditor ? 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition-shadow' : ''}`}
                          style={{ backgroundColor: getUtilizationBgColor(dayData.allocationPct) }}
                          title={`${dayData.allocationPct}% allocated (${dayData.allocated}h / ${dayData.available}h available)${dayData.actual ? ` • Actual: ${dayData.actual}h` : ''}${isEditor ? ' — Click to edit' : ''}`}
                          onClick={() => handleCellClick(item, dateStr)}
                        >
                          {dayData.allocationPct > 0 ? `${dayData.allocationPct}%` : ''}
                        </div>
                        {showActuals && dayData.actual > 0 && (
                          <div className="mt-0.5">
                            {(dayData.actualByProject?.length || 0) > 0 ? (
                              <div className="space-y-px">
                                {dayData.actualByProject.map((p, i) => {
                                  const actualPct = dayData.available > 0 ? Math.round((p.hours / dayData.available) * 100) : 0;
                                  const plannedPct = dayData.plannedByProject?.[p.project] || 0;
                                  const diff = actualPct - plannedPct;
                                  return (
                                    <div key={i} className="text-[9px] leading-tight flex items-center gap-0.5" title={`${p.project}: ${p.hours}h (${actualPct}% actual, ${plannedPct}% planned)`}>
                                      <span
                                        className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                                        style={{ backgroundColor: ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#EC4899','#06B6D4','#84CC16'][i % 8] }}
                                      />
                                      <span className="text-gray-600">{p.project}</span>
                                      <span className="text-purple-600 font-medium">{actualPct}%</span>
                                      {plannedPct > 0 && diff !== 0 && (
                                        <span className={`font-medium ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                          {diff > 0 ? '+' : ''}{diff}
                                        </span>
                                      )}
                                      {plannedPct === 0 && (
                                        <span className="text-orange-400 font-medium">!</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-[10px] text-purple-600 font-medium leading-none text-center">{dayData.actual}h</div>
                            )}
                          </div>
                        )}
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
                    {showActuals && item.summary.totalActualHours > 0 && (
                      <div className="text-[10px] text-purple-600 font-medium mt-1">
                        ⏱ {item.summary.totalActualHours}h
                        <span className="text-gray-500 ml-0.5">
                          ({item.summary.totalAvailableHours > 0 ? Math.round((item.summary.totalActualHours / item.summary.totalAvailableHours) * 100) : 0}%)
                        </span>
                      </div>
                    )}
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
          <h3 className="font-medium text-sm text-gray-700 mb-3">Absence</h3>
          <div className="space-y-3">
            <select
              className="input text-sm"
              value={cellAbsence.absenceTypeId}
              onChange={(e) => setCellAbsence(prev => ({ ...prev, absenceTypeId: e.target.value }))}
            >
              <option value="">No absence</option>
              {absenceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {cellAbsence.absenceTypeId && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Start Date</label>
                    <input
                      type="date"
                      className="input text-sm"
                      value={cellAbsence.startDate}
                      onChange={(e) => setCellAbsence(prev => ({ ...prev, startDate: e.target.value, endDate: prev.endDate < e.target.value ? e.target.value : prev.endDate }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">End Date</label>
                    <input
                      type="date"
                      className="input text-sm"
                      value={cellAbsence.endDate}
                      min={cellAbsence.startDate}
                      onChange={(e) => setCellAbsence(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={cellAbsence.isHalfDay}
                    onChange={(e) => setCellAbsence(prev => ({ ...prev, isHalfDay: e.target.checked }))}
                    className="rounded"
                  />
                  Half day
                </label>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button onClick={() => setShowCellModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSaveCellAllocations} className="btn-primary">Save Changes</button>
        </div>
      </Modal>

      {/* ─── Week Edit Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={showWeekModal} onClose={() => setShowWeekModal(false)} title={`Week Allocation — ${weekEditPerson?.name}`} size="md">
        <div className="mb-4">
          <span className="text-sm text-gray-500">
            📅 Week: {weekEditPerson?.weekStart} → {weekEditPerson?.weekEnd}
          </span>
          <p className="text-xs text-gray-400 mt-1">
            Sets the allocation percentage for the entire week (Mon–Sun). Existing allocations for the same project in this period will be updated.
          </p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm text-gray-700">Projects</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${weekTotalPct > 100 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                Total: {weekTotalPct}%{weekTotalPct > 100 && ' ⚠️'}
              </span>
              <button
                onClick={() => setWeekAllocations(prev => [...prev, { id: null, projectId: '', percentage: 100 }])}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                + Add Project
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {weekAllocations.map((alloc, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <select
                  className="input flex-1 text-sm"
                  value={alloc.projectId}
                  onChange={(e) => setWeekAllocations(prev => prev.map((a, i) => i === idx ? { ...a, projectId: e.target.value } : a))}
                >
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
                <div className="relative w-24">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input text-sm pr-6"
                    value={alloc.percentage}
                    onChange={(e) => setWeekAllocations(prev => prev.map((a, i) => i === idx ? { ...a, percentage: e.target.value } : a))}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
                <button
                  onClick={() => setWeekAllocations(prev => prev.filter((_, i) => i !== idx))}
                  className="text-gray-400 hover:text-red-500 text-sm px-1"
                >✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick presets */}
        <div className="mb-6 pt-3 border-t">
          <p className="text-xs text-gray-500 mb-2">Quick presets:</p>
          <div className="flex gap-2">
            {[25, 50, 75, 100].map(pct => (
              <button
                key={pct}
                onClick={() => {
                  if (weekAllocations.length > 0) {
                    setWeekAllocations(prev => prev.map((a, i) => i === 0 ? { ...a, percentage: pct } : a));
                  }
                }}
                className="px-3 py-1 text-xs rounded-lg border hover:bg-gray-50 transition-colors"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button onClick={() => setShowWeekModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSaveWeekAllocations} className="btn-primary">Save Week</button>
        </div>
      </Modal>

      {/* ─── Weekly Working Hours Modal ───────────────────────────────────────── */}
      <Modal isOpen={showHoursModal} onClose={() => setShowHoursModal(false)} title={`Working Hours — ${hoursEditPerson?.name}`} size="md">
        <div className="mb-4">
          <span className="text-sm text-gray-500">
            📅 Week: {hoursEditPerson?.weekStart} → {hoursEditPerson?.weekEnd}
          </span>
          <p className="text-xs text-gray-400 mt-1">
            Override how many hours this person works each day <strong>this week only</strong>. Set a day to 0 if they don't work it.
            {hoursHasOverride
              ? ' This week currently uses a custom schedule.'
              : ' This week currently uses their default schedule.'}
          </p>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {HOUR_DAYS.map(([field, label]) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-500 text-center mb-1">{label}</label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                className="input text-sm text-center px-1"
                value={hoursForm[field]}
                onChange={(e) => setHoursForm(prev => ({ ...prev, [field]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-gray-500">
            Default: {HOUR_DAYS.map(([f]) => hoursEditPerson?.defaults?.[f]).join(' / ')}
          </span>
          <span className="font-medium text-gray-700">Week total: {Math.round(hoursWeekTotal * 10) / 10}h</span>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setHoursForm(hoursEditPerson?.defaults || hoursForm)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Fill from default
          </button>
        </div>

        <div className="flex justify-between gap-3 pt-4 border-t">
          <button
            onClick={handleResetHours}
            disabled={!hoursHasOverride}
            className={`text-sm ${hoursHasOverride ? 'text-red-500 hover:text-red-700' : 'text-gray-300 cursor-not-allowed'}`}
          >
            Reset to default
          </button>
          <div className="flex gap-3">
            <button onClick={() => setShowHoursModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveHours} className="btn-primary">Save Hours</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
