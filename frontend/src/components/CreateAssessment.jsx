import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAssessment, generateQuestion } from "../api";
import toast from "react-hot-toast";

export default function CreateAssessment() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", question: "", reference_answer: "", max_score: 100, deadline: "", submission_type: "text", difficulty: "medium", practice_mode: false, timer_sec: 0 });
  const [loading, setLoading] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genDifficulty, setGenDifficulty] = useState("medium");
  const [genLoading, setGenLoading] = useState(false);

  const handleGenerate = async () => {
    if (!genTopic.trim()) { toast.error("Enter a topic first"); return; }
    setGenLoading(true);
    try {
      const res = await generateQuestion({ topic: genTopic, difficulty: genDifficulty });
      setForm((f) => ({ ...f, question: res.question, reference_answer: res.reference_answer }));
      toast.success("Question generated!");
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createAssessment(form);
      toast.success("Assessment created!");
      navigate(`/teacher/assessment/${res.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (k) => (e) => {
    const val = k === "max_score" ? parseFloat(e.target.value) || 0 : k === "timer_sec" ? parseInt(e.target.value) || 0 : k === "practice_mode" ? e.target.checked : e.target.value;
    setForm({ ...form, [k]: val });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Create Assessment</h1>

      <div className="bg-indigo-50 p-4 rounded-lg shadow mb-4">
        <p className="text-sm font-medium text-indigo-800 mb-2">AI Question Generator</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-indigo-600 mb-1">Topic</label>
            <input value={genTopic} onChange={(e) => setGenTopic(e.target.value)} placeholder="e.g. Photosynthesis" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-indigo-600 mb-1">Difficulty</label>
            <select value={genDifficulty} onChange={(e) => setGenDifficulty(e.target.value)} className="border rounded px-3 py-2 text-sm bg-white">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <button onClick={handleGenerate} disabled={genLoading} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
            {genLoading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
          <input value={form.title} onChange={handleChange("title")} placeholder="e.g. Midterm Quiz 1" className="w-full border rounded px-3 py-2" required />
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
              <option value="both">Text + Image + Audio</option>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Timer (seconds, 0=off)</label>
            <input type="number" value={form.timer_sec} onChange={handleChange("timer_sec")} min="0" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.practice_mode} onChange={handleChange("practice_mode")} className="w-4 h-4" />
              <span className="text-sm font-medium text-slate-700">Practice Mode</span>
            </label>
          </div>
        </div>
        <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Creating..." : "Create Assessment"}
        </button>
      </form>
    </div>
  );
}
