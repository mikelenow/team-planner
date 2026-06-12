import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#3B82F6' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data);
    } catch (err) {
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingTeam(null);
    setForm({ name: '', color: '#3B82F6' });
    setShowModal(true);
  };

  const openEdit = (team) => {
    setEditingTeam(team);
    setForm({ name: team.name, color: team.color || '#3B82F6' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTeam) {
        await api.put(`/teams/${editingTeam.id}`, form);
        toast.success('Team updated');
      } else {
        await api.post('/teams', form);
        toast.success('Team created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (team) => {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    try {
      await api.delete(`/teams/${team.id}`);
      toast.success('Team deleted');
      loadData();
    } catch (err) {
      toast.error('Cannot delete team with people assigned');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
        <button onClick={openCreate} className="btn-primary">+ Add Team</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div key={team.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }}></div>
                <div>
                  <h3 className="font-semibold text-gray-900">{team.name}</h3>
                  <p className="text-xs text-gray-500">{team._count?.people || 0} members</p>
                </div>
              </div>
              <div className="space-x-2">
                <button onClick={() => openEdit(team)} className="text-xs text-primary-600 hover:text-primary-700">Edit</button>
                <button onClick={() => handleDelete(team)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {teams.length === 0 && <p className="text-center text-gray-500 py-12">No teams yet.</p>}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingTeam ? 'Edit Team' : 'Add Team'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} required />
          </div>
          <div>
            <label className="label">Color</label>
            <input type="color" className="input h-10" value={form.color} onChange={(e) => setForm(f => ({...f, color: e.target.value}))} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingTeam ? 'Update' : 'Create'} Team</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
