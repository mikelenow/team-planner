import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'ADMIN', label: 'Admin', description: 'Full access: manage users, all CRUD', color: 'bg-red-100 text-red-700' },
  { value: 'MANAGER', label: 'Manager', description: 'Can edit allocations, people, projects, absences', color: 'bg-blue-100 text-blue-700' },
  { value: 'VIEWER', label: 'Viewer', description: 'Read-only access to timeline and reports', color: 'bg-gray-100 text-gray-700' },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'VIEWER' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'VIEWER' });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const data = { name: form.name, email: form.email, role: form.role };
        if (form.password) data.password = form.password;
        await api.put(`/users/${editingUser.id}`, data);
        toast.success('User updated');
      } else {
        if (!form.password) {
          toast.error('Password is required for new users');
          return;
        }
        await api.post('/users', form);
        toast.success('User created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? 'User deactivated' : 'User reactivated');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('User deleted');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const getRoleBadge = (role) => {
    const r = ROLES.find(r => r.value === role);
    return r ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>{r.label}</span> : role;
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage users and their access roles</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ Add User</button>
      </div>

      {/* Role legend */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        {ROLES.map(r => (
          <div key={r.value} className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>{r.label}</span>
            <span className="text-xs text-gray-500">{r.description}</span>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={`hover:bg-gray-50 ${!user.isActive ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <span className="font-medium text-gray-900">{user.name}</span>
                  {user.id === currentUser.id && <span className="ml-2 text-xs text-primary-600">(you)</span>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openEdit(user)} className="text-sm text-primary-600 hover:text-primary-700">Edit</button>
                  <button onClick={() => handleToggleActive(user)} className="text-sm text-yellow-600 hover:text-yellow-700">
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  {user.id !== currentUser.id && (
                    <button onClick={() => handleDelete(user)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="text-center text-gray-500 py-8">No users found.</p>}
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUser ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} required />
          </div>
          <div>
            <label className="label">{editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm(f => ({...f, password: e.target.value}))} {...(!editingUser && { required: true })} placeholder={editingUser ? '••••••••' : ''} />
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="input" value={form.role} onChange={(e) => setForm(f => ({...f, role: e.target.value}))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.description}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingUser ? 'Update' : 'Create'} User</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
