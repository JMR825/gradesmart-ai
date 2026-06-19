import { useState, useEffect } from "react";
import { assessmentStats, exportCsv, backupData, clearAll, listAssessments } from "../api";
import toast from "react-hot-toast";

export default function ExportCSV() {
  const [stats, setStats] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentId, setAssessmentId] = useState("");

  useEffect(() => {
    listAssessments().then((d) => setAssessments(d.assessments)).catch(() => {});
  }, []);

  useEffect(() => {
    if (assessmentId) assessmentStats(parseInt(assessmentId)).then(setStats).catch(() => setStats(null));
    else setStats(null);
  }, [assessmentId]);

  const handleExport = () => {
    if (!assessmentId) { toast.error("Select an assessment"); return; }
    exportCsv(parseInt(assessmentId));
    toast.success("CSV download started");
  };

  const handleClear = async () => {
    if (!confirm("Delete ALL data?")) return;
    try {
      const res = await clearAll();
      toast.success(res.message);
      setStats(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Export & Manage</h1>
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-3xl font-bold text-indigo-600">{stats.total_graded || 0}</p>
            <p className="text-sm text-slate-500">Total Graded</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-3xl font-bold text-green-600">{stats.average_score || 0}</p>
            <p className="text-sm text-slate-500">Avg Score</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-3xl font-bold text-amber-600">{stats.max_score || 0}</p>
            <p className="text-sm text-slate-500">Max Score</p>
          </div>
        </div>
      )}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Assessment:</label>
          <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
            <option value="">Select an assessment</option>
            {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <button onClick={handleExport} disabled={!assessmentId} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">Download CSV</button>
        <hr className="my-4" />
        <div className="flex flex-wrap gap-3">
          <button onClick={() => backupData().then(d => { navigator.clipboard.writeText(JSON.stringify(d, null, 2)); toast.success("Backup copied!"); })} className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700">Copy Backup</button>
          <button onClick={handleClear} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Clear All Data</button>
        </div>
      </div>
    </div>
  );
}
