import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', color: '#3B82F6', description: '', startDate: '', endDate: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingProject(null);
    setForm({ name: '', code: '', color: '#3B82F6', description: '', startDate: '', endDate: '' });
    setShowModal(true);
  };

  const openEdit = (project) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      code: project.code,
      color: project.color || '#3B82F6',
      description: project.description || '',
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      endDate: project.endDate ? project.endDate.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        startDate: form.startDate ? new Date(form.startDate) : null,
        endDate: form.endDate ? new Date(form.endDate) : null,
      };
      if (editingProject) {
        await api.put(`/projects/${editingProject.id}`, data);
        toast.success('Project updated');
      } else {
        await api.post('/projects', data);
        toast.success('Project created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (project) => {
    if (!confirm(`Delete project "${project.name}"? This will remove all allocations to this project.`)) return;
    try {
      await api.delete(`/projects/${project.id}`);
      toast.success('Project deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const toggleActive = async (project) => {
    try {
      await api.put(`/projects/${project.id}`, { isActive: !project.isActive });
      toast.success(project.isActive ? 'Project archived' : 'Project reactivated');
      loadData();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button onClick={openCreate} className="btn-primary">+ Add Project</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div key={project.id} className={`card ${!project.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }}></div>
                  <Link to={`/projects/${project.id}`} className="font-semibold text-gray-900 hover:text-primary-600">
                    {project.name}
                  </Link>
                </div>
                <p className="text-xs text-gray-500 mt-1">{project.code}</p>
                {project.description && <p className="text-sm text-gray-600 mt-2">{project.description}</p>}
              </div>
              {!project.isActive && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Archived</span>}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <span className="text-xs text-gray-500">{project._count?.allocations || 0} allocations</span>
              <div className="space-x-2">
                <button onClick={() => toggleActive(project)} className="text-xs text-gray-500 hover:text-gray-700">
                  {project.isActive ? 'Archive' : 'Reactivate'}
                </button>
                <button onClick={() => openEdit(project)} className="text-xs text-primary-600 hover:text-primary-700">Edit</button>
                <button onClick={() => handleDelete(project)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && <p className="text-center text-gray-500 py-12">No projects yet. Create your first project!</p>}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingProject ? 'Edit Project' : 'Add Project'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div>
              <label className="label">Code *</label>
              <input className="input" value={form.code} onChange={(e) => setForm(f => ({...f, code: e.target.value}))} required placeholder="e.g. PROJ-001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Color</label>
              <input type="color" className="input h-10" value={form.color} onChange={(e) => setForm(f => ({...f, color: e.target.value}))} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.startDate} onChange={(e) => setForm(f => ({...f, startDate: e.target.value}))} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.endDate} onChange={(e) => setForm(f => ({...f, endDate: e.target.value}))} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingProject ? 'Update' : 'Create'} Project</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
