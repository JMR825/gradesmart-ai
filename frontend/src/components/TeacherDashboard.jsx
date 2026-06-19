import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { teacherAssessments, deleteAssessment } from "../api";
import toast from "react-hot-toast";

export default function TeacherDashboard() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => teacherAssessments().then((d) => setAssessments(d.assessments)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this assessment and all its submissions?")) return;
    try {
      await deleteAssessment(id);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">My Assessments</h1>
        <div className="flex gap-2">
          <Link to="/teacher/create" className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700">+ New Assessment</Link>
          <Link to="/teacher/editor" className="bg-white text-slate-700 px-3 py-1.5 rounded text-sm border hover:bg-slate-50">Grade Editor</Link>
          <Link to="/teacher/bulk" className="bg-white text-slate-700 px-3 py-1.5 rounded text-sm border hover:bg-slate-50">Bulk</Link>
          <Link to="/teacher/export" className="bg-white text-slate-700 px-3 py-1.5 rounded text-sm border hover:bg-slate-50">Export</Link>
          <Link to="/teacher/chart" className="bg-white text-slate-700 px-3 py-1.5 rounded text-sm border hover:bg-slate-50">Chart</Link>
          <Link to="/teacher/suggestions" className="bg-white text-slate-700 px-3 py-1.5 rounded text-sm border hover:bg-slate-50">Suggestions</Link>
        </div>
      </div>
      {assessments.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-slate-500 mb-4">No assessments yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {assessments.map((a) => (
            <div key={a.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
              <div>
                <Link to={`/teacher/assessment/${a.id}`} className="text-lg font-medium text-indigo-600 hover:underline">{a.title}</Link>
                <p className="text-sm text-slate-500 mt-1">{a.question.slice(0, 100)}</p>
                <div className="flex gap-4 mt-1 text-xs text-slate-400">
                  <span>{a.submission_count} submissions</span>
                  <span>Max: {a.max_score}</span>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Link to={`/teacher/assessment/${a.id}`} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200">View</Link>
                <Link to={`/teacher/assessment/${a.id}/edit`} className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded hover:bg-slate-200">Edit</Link>
                <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
