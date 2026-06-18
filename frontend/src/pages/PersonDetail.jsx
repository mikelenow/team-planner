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
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [hoursForm, setHoursForm] = useState({
    weekStart: '', hoursMonday: 8, hoursTuesday: 8, hoursWednesday: 8, hoursThursday: 8, hoursFriday: 6.5,
  });

  const [allocationForm, setAllocationForm] = useState({
    projectId: '', percentage: 100, startDate: '', endDate: '', notes: '',
  });
  const [absenceForm, setAbsenceForm] = useState({
    absenceTypeId: '', startDate: '', endDate: '', isHalfDay: false, notes: '',
  });

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [personRes, projectsRes, typesRes, schedulesRes] = await Promise.all([
        api.get(`/people/${id}`),
        api.get('/projects?isActive=true'),
        api.get('/absences/types'),
        api.get('/schedules', { params: { personId: id } }),
      ]);
      setPerson(personRes.data);
      setProjects(projectsRes.data);
      setAbsenceTypes(typesRes.data);
      setSchedules(schedulesRes.data);
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

  const HOUR_DAYS = [
    ['hoursMonday', 'Mon'], ['hoursTuesday', 'Tue'], ['hoursWednesday', 'Wed'],
    ['hoursThursday', 'Thu'], ['hoursFriday', 'Fri'],
  ];

  // Monday (yyyy-MM-dd) of the week containing the given date string
  const mondayOf = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0=Sun..6=Sat
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  };

  const openAddHours = () => {
    setHoursForm({
      weekStart: mondayOf(new Date().toISOString().slice(0, 10)),
      hoursMonday: person.hoursMonday, hoursTuesday: person.hoursTuesday, hoursWednesday: person.hoursWednesday,
      hoursThursday: person.hoursThursday, hoursFriday: person.hoursFriday,
    });
    setShowHoursModal(true);
  };

  const openEditHours = (s) => {
    setHoursForm({
      weekStart: new Date(s.weekStart).toISOString().slice(0, 10),
      hoursMonday: s.hoursMonday, hoursTuesday: s.hoursTuesday, hoursWednesday: s.hoursWednesday,
      hoursThursday: s.hoursThursday, hoursFriday: s.hoursFriday,
    });
    setShowHoursModal(true);
  };

  const handleSaveHours = async (e) => {
    e.preventDefault();
    try {
      await api.post('/schedules', {
        personId: id,
        weekStart: hoursForm.weekStart,
        ...Object.fromEntries(['hoursMonday', 'hoursTuesday', 'hoursWednesday', 'hoursThursday', 'hoursFriday']
          .map(f => [f, parseFloat(hoursForm[f]) || 0])),
      });
      toast.success('Weekly hours saved');
      setShowHoursModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDeleteHours = async (s) => {
    if (!confirm('Reset this week to the default schedule?')) return;
    try {
      await api.delete('/schedules', { params: { personId: id, weekStart: new Date(s.weekStart).toISOString().slice(0, 10) } });
      toast.success('Override removed');
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

      {/* Weekly Hours */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Weekly Working Hours</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Default: {HOUR_DAYS.map(([f]) => person[f]).join(' / ')} ({weeklyHours}h/week). Add overrides for weeks that differ.
            </p>
          </div>
          <button onClick={openAddHours} className="btn-primary text-sm">+ Add week override</button>
        </div>
        {schedules.length === 0 ? (
          <p className="text-gray-500 text-sm">No week overrides — every week uses the default schedule.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b">
                  <th className="py-2 pr-4">Week of</th>
                  {HOUR_DAYS.map(([f, label]) => <th key={f} className="py-2 px-2 text-center">{label}</th>)}
                  <th className="py-2 px-2 text-center">Total</th>
                  <th className="py-2 pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const total = HOUR_DAYS.reduce((sum, [f]) => sum + s[f], 0);
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{formatDateDisplay(s.weekStart)}</td>
                      {HOUR_DAYS.map(([f]) => (
                        <td key={f} className={`py-2 px-2 text-center ${s[f] === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{s[f]}</td>
                      ))}
                      <td className="py-2 px-2 text-center font-semibold">{Math.round(total * 10) / 10}h</td>
                      <td className="py-2 pl-2 text-right whitespace-nowrap">
                        <button onClick={() => openEditHours(s)} className="text-xs text-primary-600 hover:text-primary-700 mr-3">Edit</button>
                        <button onClick={() => handleDeleteHours(s)} className="text-xs text-red-500 hover:text-red-700">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Weekly Hours Modal */}
      <Modal isOpen={showHoursModal} onClose={() => setShowHoursModal(false)} title="Week Override">
        <form onSubmit={handleSaveHours} className="space-y-4">
          <div>
            <label className="label">Week (any day in the target week) *</label>
            <input
              type="date"
              className="input"
              value={hoursForm.weekStart}
              onChange={(e) => setHoursForm(f => ({ ...f, weekStart: mondayOf(e.target.value) }))}
              required
            />
            <p className="text-xs text-gray-400 mt-1">Saved against the Monday of the chosen week. Set a day to 0 if not worked.</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {HOUR_DAYS.map(([f, label]) => (
              <div key={f}>
                <label className="block text-xs font-medium text-gray-500 text-center mb-1">{label}</label>
                <input
                  type="number" min="0" max="24" step="0.5"
                  className="input text-sm text-center px-1"
                  value={hoursForm[f]}
                  onChange={(e) => setHoursForm(prev => ({ ...prev, [f]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="text-right text-sm text-gray-600">
            Week total: {Math.round(HOUR_DAYS.reduce((sum, [f]) => sum + (parseFloat(hoursForm[f]) || 0), 0) * 10) / 10}h
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowHoursModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Override</button>
          </div>
        </form>
      </Modal>

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
