import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function PeoplePage() {
  const [people, setPeople] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [filters, setFilters] = useState({ roleId: '', teamId: '', isActive: 'true' });

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', roleId: '', teamId: '',
    hoursMonday: 8, hoursTuesday: 8, hoursWednesday: 8, hoursThursday: 8, hoursFriday: 6.5,
  });

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.roleId) params.set('roleId', filters.roleId);
      if (filters.teamId) params.set('teamId', filters.teamId);
      if (filters.isActive) params.set('isActive', filters.isActive);

      const [peopleRes, rolesRes, teamsRes] = await Promise.all([
        api.get(`/people?${params}`),
        api.get('/roles'),
        api.get('/teams'),
      ]);
      setPeople(peopleRes.data);
      setRoles(rolesRes.data);
      setTeams(teamsRes.data);
    } catch (err) {
      toast.error('Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingPerson(null);
    const defaultRole = roles.find(r => r.name === 'Developer') || roles[0];
    const defaultTeam = teams.find(t => t.name === 'Development');
    setForm({
      firstName: '', lastName: '', email: '', roleId: defaultRole?.id || '', teamId: defaultTeam?.id || '',
      hoursMonday: 8, hoursTuesday: 8, hoursWednesday: 8, hoursThursday: 8, hoursFriday: 6.5,
    });
    setShowModal(true);
  };

  const openEdit = (person) => {
    setEditingPerson(person);
    setForm({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email || '',
      roleId: person.roleId,
      teamId: person.teamId || '',
      hoursMonday: person.hoursMonday,
      hoursTuesday: person.hoursTuesday,
      hoursWednesday: person.hoursWednesday,
      hoursThursday: person.hoursThursday,
      hoursFriday: person.hoursFriday,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, teamId: form.teamId || null };
      if (editingPerson) {
        await api.put(`/people/${editingPerson.id}`, data);
        toast.success('Person updated');
      } else {
        await api.post('/people', data);
        toast.success('Person added');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (person) => {
    if (!confirm(`Delete ${person.firstName} ${person.lastName}? This will remove all their allocations and absences.`)) return;
    try {
      await api.delete(`/people/${person.id}`);
      toast.success('Person deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const weeklyHours = (p) => p.hoursMonday + p.hoursTuesday + p.hoursWednesday + p.hoursThursday + p.hoursFriday;

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">People</h1>
        <button onClick={openCreate} className="btn-primary">+ Add Person</button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select className="input w-48" value={filters.roleId} onChange={(e) => setFilters(f => ({...f, roleId: e.target.value}))}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="input w-48" value={filters.teamId} onChange={(e) => setFilters(f => ({...f, teamId: e.target.value}))}>
          <option value="">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input w-36" value={filters.isActive} onChange={(e) => setFilters(f => ({...f, isActive: e.target.value}))}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours/Week</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {people.map((person) => (
              <tr key={person.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link to={`/people/${person.id}`} className="font-medium text-gray-900 hover:text-primary-600">
                    {person.firstName} {person.lastName}
                  </Link>
                  {person.email && <p className="text-xs text-gray-500">{person.email}</p>}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: person.role?.color + '20', color: person.role?.color }}>
                    {person.role?.shortName || person.role?.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{person.team?.name || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{weeklyHours(person)}h</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openEdit(person)} className="text-sm text-primary-600 hover:text-primary-700">Edit</button>
                  <button onClick={() => handleDelete(person)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {people.length === 0 && <p className="text-center text-gray-500 py-8">No people found.</p>}
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingPerson ? 'Edit Person' : 'Add Person'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm(f => ({...f, firstName: e.target.value}))} required />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm(f => ({...f, lastName: e.target.value}))} required />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.roleId} onChange={(e) => setForm(f => ({...f, roleId: e.target.value}))} required>
                <option value="">Select role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Team</label>
              <select className="input" value={form.teamId} onChange={(e) => setForm(f => ({...f, teamId: e.target.value}))}>
                <option value="">No team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Working Hours per Day</label>
            <div className="grid grid-cols-5 gap-2">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                <div key={day}>
                  <label className="text-xs text-gray-500">{day.slice(0, 3)}</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    className="input text-sm"
                    value={form[`hours${day}`]}
                    onChange={(e) => setForm(f => ({...f, [`hours${day}`]: parseFloat(e.target.value) || 0}))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Weekly total: {form.hoursMonday + form.hoursTuesday + form.hoursWednesday + form.hoursThursday + form.hoursFriday}h
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingPerson ? 'Update' : 'Add'} Person</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
