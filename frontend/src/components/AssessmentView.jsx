import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getAssessment, teacherSubmissions, assessmentStats, assessmentSuggestions, exportCsv, updateSubmission } from "../api";
import toast from "react-hot-toast";

export default function AssessmentView() {
  const { id } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    Promise.all([
      getAssessment(id),
      teacherSubmissions({ assessment_id: id, per_page: 500 }),
      assessmentStats(id),
      assessmentSuggestions(id),
    ]).then(([a, s, st, sug]) => {
      setAssessment(a);
      setSubmissions(s.submissions);
      setStats(st);
      setSuggestions(sug);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const startEdit = (sub) => {
    setEditing(sub.id);
    setEditForm({ score: sub.score, feedback: sub.feedback, student_name: sub.student_name });
  };

  const saveEdit = async (subId) => {
    try {
      await updateSubmission(subId, editForm);
      toast.success("Saved");
      setEditing(null);
      const [s, st] = await Promise.all([teacherSubmissions({ assessment_id: id, per_page: 500 }), assessmentStats(id)]);
      setSubmissions(s.submissions);
      setStats(st);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  if (loading) return <p className="text-slate-500">Loading assessment...</p>;
  if (!assessment) return <p className="text-red-500">Assessment not found</p>;

  const color = (score) => score >= 90 ? "text-green-600" : score >= 70 ? "text-yellow-600" : score >= 50 ? "text-orange-600" : "text-red-600";

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold">{assessment.title}</h1>
          <p className="text-slate-600 mt-1">{assessment.question}</p>
          <div className="flex gap-4 text-sm text-slate-400 mt-1">
            <span>Max: {assessment.max_score}</span>
            {assessment.deadline && <span>Due: {assessment.deadline}</span>}
            <span>Type: {assessment.submission_type}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/teacher/assessment/${id}/edit`} className="bg-white text-slate-700 px-3 py-2 rounded text-sm border hover:bg-slate-50">Edit</Link>
          <button onClick={() => exportCsv(id)} className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700">CSV</button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-white p-3 rounded-lg shadow text-center"><p className="text-xl font-bold text-indigo-600">{stats.total_graded}</p><p className="text-xs text-slate-500">Graded</p></div>
          <div className="bg-white p-3 rounded-lg shadow text-center"><p className="text-xl font-bold text-green-600">{stats.average_score}</p><p className="text-xs text-slate-500">Avg</p></div>
          <div className="bg-white p-3 rounded-lg shadow text-center"><p className="text-xl font-bold text-amber-600">{stats.max_score}</p><p className="text-xs text-slate-500">Max</p></div>
          <div className="bg-white p-3 rounded-lg shadow text-center"><p className="text-xl font-bold text-red-600">{stats.min_score}</p><p className="text-xs text-slate-500">Min</p></div>
          <div className="bg-white p-3 rounded-lg shadow text-center"><p className="text-xl font-bold text-slate-600">{stats.excellent + stats.good + stats.average + stats.poor}</p><p className="text-xs text-slate-500">Total</p></div>
        </div>
      )}

      {suggestions?.common_mistakes?.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded mb-4">
          <p className="text-sm font-medium text-amber-800">Common Mistakes:</p>
          {suggestions.common_mistakes.slice(0, 3).map((m, i) => (
            <p key={i} className="text-xs text-amber-700 mt-1">"{m.answer}" — {m.count} student{m.count > 1 ? "s" : ""}</p>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3">Student</th>
              <th className="text-left p-3">Answer</th>
              <th className="text-center p-3">Score</th>
              <th className="text-left p-3">Feedback</th>
              <th className="text-center p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {submissions.map((s) => (
              <tr key={s.id}>
                {editing === s.id ? (
                  <>
                    <td className="p-2"><input value={editForm.student_name} onChange={(e) => setEditForm({...editForm, student_name: e.target.value})} className="border rounded px-2 py-1 w-28 text-xs" /></td>
                    <td className="p-2 text-slate-500 text-xs">{s.original_answer}</td>
                    <td className="p-2 text-center"><input type="number" value={editForm.score} onChange={(e) => setEditForm({...editForm, score: e.target.value})} className="border rounded px-2 py-1 w-16 text-xs text-center" /></td>
                    <td className="p-2"><textarea value={editForm.feedback} onChange={(e) => setEditForm({...editForm, feedback: e.target.value})} rows={2} className="border rounded px-2 py-1 w-full text-xs" /></td>
                    <td className="p-2 text-center">
                      <button onClick={() => saveEdit(s.id)} className="text-xs text-indigo-600 hover:underline mr-2">Save</button>
                      <button onClick={() => setEditing(null)} className="text-xs text-slate-500 hover:underline">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 font-medium">{s.student_name}</td>
                    <td className="p-3 text-slate-600 text-xs max-w-xs truncate">{s.original_answer}</td>
                    <td className={`p-3 text-center font-bold ${color(s.score)}`}>{s.score}</td>
                    <td className="p-3 text-xs text-slate-500 max-w-sm truncate">{s.feedback}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => startEdit(s)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400">No submissions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
