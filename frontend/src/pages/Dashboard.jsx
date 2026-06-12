import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { getUtilizationColor } from '../utils/helpers';

export default function Dashboard() {
  const [stats, setStats] = useState({ people: 0, projects: 0, teams: 0 });
  const [utilization, setUtilization] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [peopleRes, projectsRes, teamsRes] = await Promise.all([
        api.get('/people?isActive=true'),
        api.get('/projects?isActive=true'),
        api.get('/teams'),
      ]);

      setStats({
        people: peopleRes.data.length,
        projects: projectsRes.data.length,
        teams: teamsRes.data.length,
      });

      // Load current week utilization
      const now = new Date();
      const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const utilRes = await api.get(`/utilization?startDate=${weekStart}&endDate=${weekEnd}`);
      setUtilization(utilRes.data.people || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
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

      {/* This week's utilization */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">This Week's Utilization</h2>
          <Link to="/timeline" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View Timeline →
          </Link>
        </div>

        {utilization.length === 0 ? (
          <p className="text-gray-500 text-sm">No people found. <Link to="/people" className="text-primary-600">Add some people</Link> to get started.</p>
        ) : (
          <div className="space-y-3">
            {utilization.map((item) => (
              <div key={item.person.id} className="flex items-center gap-4">
                <Link to={`/people/${item.person.id}`} className="w-48 truncate text-sm font-medium text-gray-900 hover:text-primary-600">
                  {item.person.firstName} {item.person.lastName}
                </Link>
                <span className="text-xs text-gray-500 w-16">{item.person.role?.shortName || item.person.role?.name}</span>
                <div className="flex-1">
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
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
                <span className={`text-sm font-medium w-14 text-right px-2 py-0.5 rounded ${getUtilizationColor(item.summary.utilization)}`}>
                  {item.summary.utilization}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
