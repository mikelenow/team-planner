import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatDateDisplay } from '../utils/helpers';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (err) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!project) return <p className="text-gray-500">Project not found.</p>;

  return (
    <div>
      <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700 mb-4 inline-block">← Back to Projects</Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }}></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-500 text-sm">{project.code}</p>
        </div>
      </div>

      {project.description && (
        <p className="text-gray-600 mb-6">{project.description}</p>
      )}

      {(project.startDate || project.endDate) && (
        <p className="text-sm text-gray-500 mb-6">
          {project.startDate && `From: ${formatDateDisplay(project.startDate)}`}
          {project.startDate && project.endDate && ' — '}
          {project.endDate && `To: ${formatDateDisplay(project.endDate)}`}
        </p>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Allocated People</h2>
        {project.allocations?.length === 0 ? (
          <p className="text-gray-500 text-sm">No one allocated to this project yet.</p>
        ) : (
          <div className="space-y-3">
            {project.allocations?.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Link to={`/people/${a.person?.id}`} className="font-medium text-sm hover:text-primary-600">
                    {a.person?.firstName} {a.person?.lastName}
                  </Link>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: a.person?.role?.color + '20', color: a.person?.role?.color }}>
                    {a.person?.role?.shortName || a.person?.role?.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{a.percentage}%</span>
                  <p className="text-xs text-gray-500">
                    {formatDateDisplay(a.startDate)} – {formatDateDisplay(a.endDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
