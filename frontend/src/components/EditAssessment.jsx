import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAssessment, updateAssessment } from "../api";
import toast from "react-hot-toast";

export default function EditAssessment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssessment(id).then((a) => {
      setForm({ title: a.title, question: a.question, reference_answer: a.reference_answer, max_score: a.max_score, deadline: a.deadline || "", submission_type: a.submission_type, difficulty: a.difficulty || "medium", practice_mode: a.practice_mode || false, timer_sec: a.timer_sec || 0 });
    }).catch(() => navigate("/teacher")).finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateAssessment(id, form);
      toast.success("Assessment updated!");
      navigate(`/teacher/assessment/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  const handleChange = (k) => (e) => {
    const val = k === "max_score" ? parseFloat(e.target.value) || 0 : k === "timer_sec" ? parseInt(e.target.value) || 0 : k === "practice_mode" ? e.target.checked : e.target.value;
    setForm({ ...form, [k]: val });
  };

  if (loading) return <p className="text-slate-500">Loading...</p>;
  if (!form) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Edit Assessment</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
          <input value={form.title} onChange={handleChange("title")} className="w-full border rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
          <textarea value={form.question} onChange={handleChange("question")} rows={3} className="w-full border rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reference Answer</label>
          <textarea value={form.reference_answer} onChange={handleChange("reference_answer")} rows={3} className="w-full border rounded px-3 py-2" required />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Score</label>
            <input type="number" value={form.max_score} onChange={handleChange("max_score")} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
            <input type="date" value={form.deadline} onChange={handleChange("deadline")} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Submission Type</label>
            <select value={form.submission_type} onChange={handleChange("submission_type")} className="w-full border rounded px-3 py-2 bg-white">
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
            <select value={form.difficulty} onChange={handleChange("difficulty")} className="w-full border rounded px-3 py-2 bg-white">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Timer (seconds)</label>
            <input type="number" value={form.timer_sec} onChange={handleChange("timer_sec")} min="0" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.practice_mode} onChange={handleChange("practice_mode")} className="w-4 h-4" />
              <span className="text-sm font-medium text-slate-700">Practice Mode</span>
            </label>
          </div>
        </div>
        <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">Save Changes</button>
      </form>
    </div>
  );
}
