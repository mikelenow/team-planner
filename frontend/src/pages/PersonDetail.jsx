import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatDateDisplay } from '../utils/helpers';
import Modal from '../components/Modal';

export default function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [projects, setProjects] = useState([]);
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);

  const [allocationForm, setAllocationForm] = useState({
    projectId: '', percentage: 100, startDate: '', endDate: '', notes: '',
  });
  const [absenceForm, setAbsenceForm] = useState({
    absenceTypeId: '', startDate: '', endDate: '', isHalfDay: false, notes: '',
  });

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [personRes, projectsRes, typesRes] = await Promise.all([
        api.get(`/people/${id}`),
        api.get('/projects?isActive=true'),
        api.get('/absences/types'),
      ]);
      setPerson(personRes.data);
      setProjects(projectsRes.data);
      setAbsenceTypes(typesRes.data);
    } catch (err) {
      toast.error('Failed to load person');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllocation = async (e) => {
    e.preventDefault();
    try {
      await api.post('/allocations', { ...allocationForm, personId: id });
      toast.success('Allocation added');
      setShowAllocationModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to add allocation');
    }
  };

  const handleDeleteAllocation = async (allocId) => {
    if (!confirm('Remove this allocation?')) return;
    try {
      await api.delete(`/allocations/${allocId}`);
      toast.success('Allocation removed');
      loadData();
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  const handleAddAbsence = async (e) => {
    e.preventDefault();
    try {
      await api.post('/absences', { ...absenceForm, personId: id });
      toast.success('Absence added');
      setShowAbsenceModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to add absence');
    }
  };

  const handleDeleteAbsence = async (absId) => {
    if (!confirm('Remove this absence?')) return;
    try {
      await api.delete(`/absences/${absId}`);
      toast.success('Absence removed');
      loadData();
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!person) return <p className="text-gray-500">Person not found.</p>;

  const weeklyHours = person.hoursMonday + person.hoursTuesday + person.hoursWednesday + person.hoursThursday + person.hoursFriday;

  return (
    <div>
      <Link to="/people" className="text-sm text-primary-600 hover:text-primary-700 mb-4 inline-block">← Back to People</Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{person.firstName} {person.lastName}</h1>
          <p className="text-gray-500">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2" style={{ backgroundColor: person.role?.color + '20', color: person.role?.color }}>
              {person.role?.name}
            </span>
            {person.team && <span className="text-sm">• {person.team.name}</span>}
            <span className="text-sm ml-2">• {weeklyHours}h/week</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocations */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Project Allocations</h2>
            <button onClick={() => setShowAllocationModal(true)} className="btn-primary text-sm">+ Add</button>
          </div>
          {person.allocations?.length === 0 ? (
            <p className="text-gray-500 text-sm">No allocations yet.</p>
          ) : (
            <div className="space-y-3">
              {person.allocations?.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm" style={{ color: a.project?.color || '#333' }}>
                      {a.project?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateDisplay(a.startDate)} – {formatDateDisplay(a.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{a.percentage}%</span>
                    <button onClick={() => handleDeleteAllocation(a.id)} className="text-xs text-red-500 hover:text-red-700">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Absences */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Absences</h2>
            <button onClick={() => setShowAbsenceModal(true)} className="btn-primary text-sm">+ Add</button>
          </div>
          {person.absences?.length === 0 ? (
            <p className="text-gray-500 text-sm">No absences recorded.</p>
          ) : (
            <div className="space-y-3">
              {person.absences?.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: a.absenceType?.color }}></span>
                      {a.absenceType?.name}
                      {a.isHalfDay && <span className="text-xs text-gray-500 ml-1">(half day)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateDisplay(a.startDate)} – {formatDateDisplay(a.endDate)}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteAbsence(a.id)} className="text-xs text-red-500 hover:text-red-700">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Allocation Modal */}
      <Modal isOpen={showAllocationModal} onClose={() => setShowAllocationModal(false)} title="Add Allocation">
        <form onSubmit={handleAddAllocation} className="space-y-4">
          <div>
            <label className="label">Project *</label>
            <select className="input" value={allocationForm.projectId} onChange={(e) => setAllocationForm(f => ({...f, projectId: e.target.value}))} required>
              <option value="">Select project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Percentage *</label>
            <input type="number" className="input" min="1" max="100" value={allocationForm.percentage} onChange={(e) => setAllocationForm(f => ({...f, percentage: parseInt(e.target.value)}))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input type="date" className="input" value={allocationForm.startDate} onChange={(e) => setAllocationForm(f => ({...f, startDate: e.target.value}))} required />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input type="date" className="input" value={allocationForm.endDate} onChange={(e) => setAllocationForm(f => ({...f, endDate: e.target.value}))} required />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={allocationForm.notes} onChange={(e) => setAllocationForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAllocationModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Allocation</button>
          </div>
        </form>
      </Modal>

      {/* Absence Modal */}
      <Modal isOpen={showAbsenceModal} onClose={() => setShowAbsenceModal(false)} title="Add Absence">
        <form onSubmit={handleAddAbsence} className="space-y-4">
          <div>
            <label className="label">Type *</label>
            <select className="input" value={absenceForm.absenceTypeId} onChange={(e) => setAbsenceForm(f => ({...f, absenceTypeId: e.target.value}))} required>
              <option value="">Select type</option>
              {absenceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input type="date" className="input" value={absenceForm.startDate} onChange={(e) => setAbsenceForm(f => ({...f, startDate: e.target.value}))} required />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input type="date" className="input" value={absenceForm.endDate} onChange={(e) => setAbsenceForm(f => ({...f, endDate: e.target.value}))} required />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={absenceForm.isHalfDay} onChange={(e) => setAbsenceForm(f => ({...f, isHalfDay: e.target.checked}))} className="rounded" />
              <span className="text-sm">Half day only</span>
            </label>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={absenceForm.notes} onChange={(e) => setAbsenceForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAbsenceModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Absence</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
