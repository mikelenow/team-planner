import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { getUtilizationColor } from '../utils/helpers';

export default function Dashboard() {
  const [stats, setStats] = useState({ people: 0, projects: 0, teams: 0 });
  const [weekData, setWeekData] = useState(null);
  const [monthData, setMonthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const now = new Date();
      const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

      const [peopleRes, projectsRes, teamsRes, weekRes, monthRes] = await Promise.all([
        api.get('/people?isActive=true'),
        api.get('/projects?isActive=true'),
        api.get('/teams'),
        api.get(`/utilization?startDate=${weekStart}&endDate=${weekEnd}`),
        api.get(`/utilization?startDate=${monthStart}&endDate=${monthEnd}`),
      ]);

      setStats({
        people: peopleRes.data.length,
        projects: projectsRes.data.length,
        teams: teamsRes.data.length,
      });

      setWeekData(aggregateCapacity(weekRes.data.people || [], `Week (${weekStart} – ${weekEnd})`));
      setMonthData(aggregateCapacity(monthRes.data.people || [], format(now, 'MMMM yyyy')));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate capacity data across all people
  const aggregateCapacity = (people, label) => {
    let totalCapacity = 0;
    let totalAllocated = 0;
    let totalAbsence = 0;
    const projectHours = {}; // projectName -> hours

    people.forEach(item => {
      totalCapacity += item.summary.totalAvailableHours + item.summary.totalAbsenceHours;
      totalAllocated += item.summary.totalAllocatedHours;
      totalAbsence += item.summary.totalAbsenceHours;

      // Aggregate per project
      item.allocations?.forEach(a => {
        const projName = a.project?.name || 'Unknown';
        const projColor = a.project?.color || '#6B7280';
        // Estimate hours for this allocation within the period
        if (!projectHours[projName]) {
          projectHours[projName] = { hours: 0, color: projColor };
        }
      });
    });

    // Better project aggregation from daily data
    const projectMap = {};
    people.forEach(item => {
      item.daily?.forEach(day => {
        if (day.weekend || day.holiday || day.available === 0) return;
      });
      item.allocations?.forEach(a => {
        const key = a.project?.name || 'Unknown';
        if (!projectMap[key]) {
          projectMap[key] = { hours: 0, color: a.project?.color || '#6B7280', id: a.project?.id };
        }
        // Calculate proportional hours
        const pctHours = (a.percentage / 100) * (item.summary.totalAvailableHours + item.summary.totalAbsenceHours);
        projectMap[key].hours += pctHours;
      });
    });

    const available = totalCapacity - totalAbsence;
    const remaining = available - totalAllocated;

    return {
      label,
      totalCapacity,
      available,
      totalAllocated,
      totalAbsence,
      remaining: Math.max(remaining, 0),
      overallocated: remaining < 0 ? Math.abs(remaining) : 0,
      utilizationPct: available > 0 ? Math.round((totalAllocated / available) * 100) : 0,
      people,
      projects: Object.entries(projectMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.hours - a.hours),
    };
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link to="/people" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active People</p>
              <p className="text-3xl font-bold text-gray-900">{stats.people}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </Link>
        <Link to="/projects" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Projects</p>
              <p className="text-3xl font-bold text-gray-900">{stats.projects}</p>
            </div>
            <div className="text-4xl">📁</div>
          </div>
        </Link>
        <Link to="/teams" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Teams</p>
              <p className="text-3xl font-bold text-gray-900">{stats.teams}</p>
            </div>
            <div className="text-4xl">🏢</div>
          </div>
        </Link>
      </div>

      {/* Capacity Overview: Week & Month side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {weekData && <CapacityCard data={weekData} period="week" />}
        {monthData && <CapacityCard data={monthData} period="month" />}
      </div>

      {/* Per-person breakdown for this week */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">This Week — Per Person</h2>
          <Link to="/timeline" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View Timeline →
          </Link>
        </div>

        {weekData?.people.length === 0 ? (
          <p className="text-gray-500 text-sm">No people found. <Link to="/people" className="text-primary-600">Add some people</Link> to get started.</p>
        ) : (
          <div className="space-y-3">
            {weekData?.people.map((item) => (
              <div key={item.person.id} className="flex items-center gap-4">
                <Link to={`/people/${item.person.id}`} className="w-44 truncate text-sm font-medium text-gray-900 hover:text-primary-600">
                  {item.person.firstName} {item.person.lastName}
                </Link>
                <span className="text-xs text-gray-500 w-12">{item.person.role?.shortName || item.person.role?.name}</span>
                <div className="flex-1">
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.summary.utilization > 100 ? 'bg-red-500' :
                        item.summary.utilization > 80 ? 'bg-yellow-500' :
                        item.summary.utilization > 50 ? 'bg-green-500' : 'bg-blue-400'
                      }`}
                      style={{ width: `${Math.min(item.summary.utilization, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-right w-32">
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${getUtilizationColor(item.summary.utilization)}`}>
                    {item.summary.utilization}%
                  </span>
                  <span className="text-xs text-gray-400 ml-1">
                    {item.summary.totalAllocatedHours}h / {item.summary.totalAvailableHours}h
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Capacity Card Component ────────────────────────────────────────────────

function CapacityCard({ data, period }) {
  const { label, totalCapacity, available, totalAllocated, totalAbsence, remaining, overallocated, utilizationPct, projects } = data;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">{period === 'week' ? '📅 This Week' : '📆 This Month'}</h2>
      <p className="text-xs text-gray-500 mb-4">{label}</p>

      {/* Main capacity gauge */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Team Utilization</span>
          <span className={`text-lg font-bold ${utilizationPct > 100 ? 'text-red-600' : utilizationPct > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
            {utilizationPct}%
          </span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              utilizationPct > 100 ? 'bg-red-500' :
              utilizationPct > 80 ? 'bg-yellow-500' :
              utilizationPct > 50 ? 'bg-green-500' : 'bg-blue-400'
            }`}
            style={{ width: `${Math.min(utilizationPct, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Hours breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Total Capacity</p>
          <p className="text-lg font-bold text-gray-900">{totalCapacity.toFixed(1)}h</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-gray-500">Allocated</p>
          <p className="text-lg font-bold text-blue-700">{totalAllocated.toFixed(1)}h</p>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg">
          <p className="text-xs text-gray-500">Absences</p>
          <p className="text-lg font-bold text-orange-600">{totalAbsence.toFixed(1)}h</p>
        </div>
        <div className={`p-3 rounded-lg ${overallocated > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className="text-xs text-gray-500">{overallocated > 0 ? 'Over-allocated' : 'Remaining'}</p>
          <p className={`text-lg font-bold ${overallocated > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {overallocated > 0 ? `+${overallocated.toFixed(1)}h ⚠️` : `${remaining.toFixed(1)}h`}
          </p>
        </div>
      </div>

      {/* Per-project breakdown */}
      {projects.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Hours by Project</h3>
          <div className="space-y-2">
            {projects.slice(0, 6).map((proj) => (
              <div key={proj.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }}></div>
                <span className="text-sm text-gray-700 flex-1 truncate">{proj.name}</span>
                <span className="text-sm font-medium text-gray-900">{proj.hours.toFixed(1)}h</span>
                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ backgroundColor: proj.color, width: `${Math.min((proj.hours / available) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {projects.length > 6 && (
              <p className="text-xs text-gray-400">+{projects.length - 6} more projects</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
