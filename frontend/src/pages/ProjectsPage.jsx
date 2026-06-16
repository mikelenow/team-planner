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
  const [form, setForm] = useState({ name: '', code: '', color: '#3B82F6', description: '', startDate: '', endDate: '', jiraProjectKey: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

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
    setForm({ name: '', code: '', color: '#3B82F6', description: '', startDate: '', endDate: '', jiraProjectKey: '' });
    setLogoFile(null);
    setLogoPreview(null);
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
      jiraProjectKey: project.jiraProjectKey || '',
    });
    setLogoFile(null);
    setLogoPreview(project.logo ? `${import.meta.env.VITE_API_URL || ''}/uploads/logos/${project.logo}` : null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('code', form.code);
      formData.append('color', form.color);
      formData.append('description', form.description);
      if (form.startDate) formData.append('startDate', form.startDate);
      if (form.endDate) formData.append('endDate', form.endDate);
      if (form.jiraProjectKey) formData.append('jiraProjectKey', form.jiraProjectKey);
      if (logoFile) formData.append('logo', logoFile);

      if (editingProject) {
        formData.append('isActive', editingProject.isActive);
        await api.put(`/projects/${editingProject.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Project updated');
      } else {
        await api.post('/projects', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
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
      const formData = new FormData();
      formData.append('isActive', !project.isActive);
      await api.put(`/projects/${project.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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
              <div className="flex items-start gap-3">
                {project.logo ? (
                  <img src={`${import.meta.env.VITE_API_URL || ''}/uploads/logos/${project.logo}`} alt="" className="w-8 h-8 rounded object-contain" />
                ) : (
                  <div className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: project.color }}>
                    {project.code?.slice(0, 2)}
                  </div>
                )}
                <div>
                  <Link to={`/projects/${project.id}`} className="font-semibold text-gray-900 hover:text-primary-600">
                    {project.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">{project.code}</p>
                  {project.description && <p className="text-sm text-gray-600 mt-1">{project.description}</p>}
                </div>
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
              <label className="label">Jira Project Key</label>
              <input className="input" value={form.jiraProjectKey} onChange={(e) => setForm(f => ({...f, jiraProjectKey: e.target.value}))} placeholder="e.g. NKD, APOLLO" />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} />
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

          <div>
            <label className="label">Logo</label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="relative">
                  <img src={logoPreview} alt="Logo preview" className="w-12 h-12 rounded object-contain border" />
                  <button
                    type="button"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                  >✕</button>
                </div>
              )}
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, SVG, or WebP. Max 2MB.</p>
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
