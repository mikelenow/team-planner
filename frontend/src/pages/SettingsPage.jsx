import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function SettingsPage() {
  const [roles, setRoles] = useState([]);
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAbsenceTypeModal, setShowAbsenceTypeModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', shortName: '', color: '#3B82F6' });
  const [absenceTypeForm, setAbsenceTypeForm] = useState({ name: '', color: '#10B981', isPaid: true });

  useEffect(() => { loadData(); }, [currentYear]);

  const loadData = async () => {
    try {
      const [rolesRes, typesRes, holidaysRes] = await Promise.all([
        api.get('/roles'),
        api.get('/absences/types'),
        api.get(`/holidays?year=${currentYear}`),
      ]);
      setRoles(rolesRes.data);
      setAbsenceTypes(typesRes.data);
      setHolidays(holidaysRes.data);
    } catch (err) {
      toast.error('Failed to load settings');
    }
  };

  const handleAddRole = async (e) => {
    e.preventDefault();
    try {
      await api.post('/roles', roleForm);
      toast.success('Role created');
      setShowRoleModal(false);
      setRoleForm({ name: '', shortName: '', color: '#3B82F6' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create role');
    }
  };

  const handleDeleteRole = async (role) => {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      toast.success('Role deleted');
      loadData();
    } catch (err) {
      toast.error('Cannot delete role that is assigned to people');
    }
  };

  const handleAddAbsenceType = async (e) => {
    e.preventDefault();
    try {
      await api.post('/absences/types', absenceTypeForm);
      toast.success('Absence type created');
      setShowAbsenceTypeModal(false);
      setAbsenceTypeForm({ name: '', color: '#10B981', isPaid: true });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create');
    }
  };

  const handleDeleteAbsenceType = async (type) => {
    if (!confirm(`Delete absence type "${type.name}"?`)) return;
    try {
      await api.delete(`/absences/types/${type.id}`);
      toast.success('Absence type deleted');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete absence type');
    }
  };

  const generateHolidays = async () => {
    try {
      const res = await api.post(`/holidays/generate?year=${currentYear}`);
      toast.success(res.data.message);
      loadData();
    } catch (err) {
      toast.error('Failed to generate holidays');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roles */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Roles</h2>
            <button onClick={() => setShowRoleModal(true)} className="btn-primary text-sm">+ Add</button>
          </div>
          <div className="space-y-2">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }}></div>
                  <span className="font-medium text-sm">{role.name}</span>
                  {role.shortName && <span className="text-xs text-gray-500">({role.shortName})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{role._count?.people || 0} people</span>
                  <button onClick={() => handleDeleteRole(role)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Absence Types */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Absence Types</h2>
            <button onClick={() => setShowAbsenceTypeModal(true)} className="btn-primary text-sm">+ Add</button>
          </div>
          <div className="space-y-2">
            {absenceTypes.map((type) => (
              <div key={type.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }}></div>
                  <span className="font-medium text-sm">{type.name}</span>
                  {!type.isPaid && <span className="text-xs text-gray-500">(unpaid)</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{type._count?.absences || 0} absences</span>
                  <button onClick={() => handleDeleteAbsenceType(type)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Public Holidays */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Public Holidays (Austrian - Steiermark)</h2>
            <div className="flex items-center gap-3">
              <select className="input w-28 text-sm" value={currentYear} onChange={(e) => setCurrentYear(parseInt(e.target.value))}>
                {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={generateHolidays} className="btn-secondary text-sm">Generate {currentYear}</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                <span className="text-sm">{h.name}</span>
                <span className="text-xs text-gray-500">
                  {new Date(h.date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
          {holidays.length === 0 && (
            <p className="text-gray-500 text-sm mt-2">No holidays for {currentYear}. Click "Generate" to add Austrian holidays.</p>
          )}
        </div>
      </div>

      {/* Role Modal */}
      <Modal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} title="Add Role">
        <form onSubmit={handleAddRole} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={roleForm.name} onChange={(e) => setRoleForm(f => ({...f, name: e.target.value}))} required placeholder="e.g. Backend Developer" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Short Name</label>
              <input className="input" value={roleForm.shortName} onChange={(e) => setRoleForm(f => ({...f, shortName: e.target.value}))} placeholder="e.g. BE" />
            </div>
            <div>
              <label className="label">Color</label>
              <input type="color" className="input h-10" value={roleForm.color} onChange={(e) => setRoleForm(f => ({...f, color: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowRoleModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Role</button>
          </div>
        </form>
      </Modal>

      {/* Absence Type Modal */}
      <Modal isOpen={showAbsenceTypeModal} onClose={() => setShowAbsenceTypeModal(false)} title="Add Absence Type">
        <form onSubmit={handleAddAbsenceType} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={absenceTypeForm.name} onChange={(e) => setAbsenceTypeForm(f => ({...f, name: e.target.value}))} required placeholder="e.g. Conference" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Color</label>
              <input type="color" className="input h-10" value={absenceTypeForm.color} onChange={(e) => setAbsenceTypeForm(f => ({...f, color: e.target.value}))} />
            </div>
            <div>
              <label className="label flex items-center gap-2 mt-6">
                <input type="checkbox" checked={absenceTypeForm.isPaid} onChange={(e) => setAbsenceTypeForm(f => ({...f, isPaid: e.target.checked}))} className="rounded" />
                <span className="text-sm">Paid absence</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAbsenceTypeModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Type</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
