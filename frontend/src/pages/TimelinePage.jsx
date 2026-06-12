import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format, addDays, addWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, parseISO } from 'date-fns';
import { getUtilizationBgColor } from '../utils/helpers';

export default function TimelinePage() {
  const [utilization, setUtilization] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('week'); // week | 2weeks | month
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState({ roleId: '', teamId: '' });

  useEffect(() => { loadRolesTeams(); }, []);
  useEffect(() => { loadUtilization(); }, [currentDate, viewMode, filters]);

  const loadRolesTeams = async () => {
    try {
      const [rolesRes, teamsRes] = await Promise.all([
        api.get('/roles'),
        api.get('/teams'),
      ]);
      setRoles(rolesRes.data);
      setTeams(teamsRes.data);
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

  const navigate = (direction) => {
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

  const { start, end } = getDateRange();
  const days = eachDayOfInterval({ start, end });
  const workDays = days.filter(d => getDay(d) !== 0 && getDay(d) !== 6);

  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', ''];

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
          <button onClick={() => navigate(-1)} className="btn-secondary text-sm px-3">←</button>
          <button onClick={goToToday} className="btn-secondary text-sm">Today</button>
          <button onClick={() => navigate(1)} className="btn-secondary text-sm px-3">→</button>
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

                    if (dayData.absenceType) {
                      return (
                        <td key={dateStr} className="px-1 py-2 text-center" title={dayData.absenceType}>
                          <div className="h-8 flex items-center justify-center rounded bg-gray-200 text-gray-600 text-xs">
                            {dayData.absenceType.slice(0, 3)}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={dateStr} className={`px-1 py-2 text-center ${isToday(day) ? 'bg-primary-50/50' : ''}`}>
                        <div
                          className="h-8 flex items-center justify-center rounded text-xs font-medium"
                          style={{ backgroundColor: getUtilizationBgColor(dayData.allocationPct) }}
                          title={`${dayData.allocationPct}% allocated (${dayData.allocated}h / ${dayData.available}h available)`}
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
    </div>
  );
}
