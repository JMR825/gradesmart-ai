import { useState, useEffect } from "react";
import { teacherSubmissions, updateSubmission, listAssessments } from "../api";
import toast from "react-hot-toast";

export default function GradeEditor() {
  const [data, setData] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    listAssessments().then((d) => {
      setAssessments(d.assessments);
      if (d.assessments.length > 0 && !assessmentId) setAssessmentId(String(d.assessments[0].id));
    }).catch(() => {});
  }, []);

  const load = () => {
    const params = { page, per_page: 200 };
    if (assessmentId) params.assessment_id = parseInt(assessmentId);
    teacherSubmissions(params).then(setData).catch(() => {});
  };
  useEffect(() => { load(); }, [page, assessmentId]);

  const startEdit = (sub) => {
    setEditing(sub.id);
    setEditForm({ score: sub.score, feedback: sub.feedback, student_name: sub.student_name });
  };

  const saveEdit = async (id) => {
    try {
      await updateSubmission(id, editForm);
      toast.success("Saved");
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Grade Editor</h1>
        <select value={assessmentId} onChange={(e) => { setAssessmentId(e.target.value); setPage(1); }} className="border rounded px-3 py-1.5 text-sm bg-white">
          <option value="">All Assessments</option>
          {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>
      {!data ? <p className="text-slate-500">Loading...</p> : (
        <>
          <p className="text-sm text-slate-500 mb-3">{data.total} submissions</p>
          <div className="space-y-3">
            {data.submissions.map((s) => (
              <div key={s.id} className="bg-white p-4 rounded-lg shadow">
                {editing === s.id ? (
                  <div className="space-y-2">
                    <input value={editForm.student_name} onChange={(e) => setEditForm({...editForm, student_name: e.target.value})} className="border rounded px-2 py-1 w-full text-sm" />
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-slate-500">Score:</label>
                      <input type="number" value={editForm.score} onChange={(e) => setEditForm({...editForm, score: e.target.value})} className="border rounded px-2 py-1 w-20 text-sm" />
                    </div>
                    <textarea value={editForm.feedback} onChange={(e) => setEditForm({...editForm, feedback: e.target.value})} rows={2} className="border rounded px-2 py-1 w-full text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(s.id)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Save</button>
                      <button onClick={() => setEditing(null)} className="text-sm text-slate-500">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{s.student_name}</p>
                        <p className="text-xs text-slate-400">{s.question_text}</p>
                      </div>
                      <span className={`text-lg font-bold ${s.score >= 70 ? "text-green-600" : s.score >= 40 ? "text-yellow-600" : "text-red-600"}`}>{s.score}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{s.feedback}</p>
                    <button onClick={() => startEdit(s)} className="text-xs text-indigo-600 mt-1 hover:underline">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {data?.pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-white rounded disabled:opacity-50 text-sm">Prev</button>
              <span className="px-3 py-1 text-sm text-slate-600">{page} / {data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-white rounded disabled:opacity-50 text-sm">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
