import { useState, useRef, useEffect } from "react";
import { bulkUpload, listAssessments } from "../api";
import toast from "react-hot-toast";

export default function BulkUpload() {
  const [assessments, setAssessments] = useState([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [items, setItems] = useState([{ student_name: "", answer: "" }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    listAssessments().then((d) => {
      setAssessments(d.assessments);
      if (d.assessments.length > 0) setAssessmentId(String(d.assessments[0].id));
    }).catch(() => {});
  }, []);

  const addRow = () => setItems([...items, { student_name: "", answer: "" }]);
  const removeRow = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };
  const update = (i, k) => (e) => { const next = [...items]; next[i][k] = e.target.value; setItems(next); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assessmentId) { toast.error("Select an assessment"); return; }
    setLoading(true);
    setResult(null);
    setProgress("Uploading...");
    try {
      const res = await bulkUpload({ assessment_id: parseInt(assessmentId), items });
      setResult(res);
      if (res.errors.length === 0) toast.success(`Processed ${res.processed} submissions`);
      else toast.error(`${res.processed} processed, ${res.errors.length} errors`);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n").filter((l) => l.trim());
      const parsed = [];
      for (const line of lines.slice(1)) {
        const cols = [];
        let current = "", inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ""; continue; }
          current += ch;
        }
        cols.push(current.trim());
        const student_name = cols[0] || "", answer = cols[1] || "";
        if (student_name && answer) parsed.push({ student_name, answer });
      }
      if (parsed.length > 0) {
        setItems(parsed);
        toast.success(`Loaded ${parsed.length} rows`);
      } else {
        toast.error("No valid rows. CSV columns: student_name,answer");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Bulk Upload</h1>
      <div className="bg-white p-4 rounded-lg shadow mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Assessment:</label>
          <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
            <option value="">Select an assessment</option>
            {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <div>
          <p className="text-sm text-slate-600 mb-2">Upload CSV (columns: student_name,answer):</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvUpload} className="text-sm" />
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="bg-white p-3 rounded-lg shadow flex gap-2 items-start">
            <input placeholder="Student Name" value={item.student_name} onChange={update(i, "student_name")} className="border rounded px-2 py-1 w-40 text-sm" required />
            <input placeholder="Answer" value={item.answer} onChange={update(i, "answer")} className="border rounded px-2 py-1 flex-1 text-sm" required />
            <button type="button" onClick={() => removeRow(i)} className="text-red-500 text-sm px-1 font-bold">&times;</button>
          </div>
        ))}
        <div className="flex gap-3">
          <button type="button" onClick={addRow} className="bg-slate-600 text-white px-4 py-2 rounded text-sm">+ Add Row</button>
          <button type="submit" disabled={loading || !assessmentId} className="bg-indigo-600 text-white px-6 py-2 rounded disabled:opacity-50">
            {loading ? progress || "Processing..." : `Submit ${items.length} Items`}
          </button>
        </div>
      </form>
      {result && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow">
          <p className="font-medium">Processed: {result.processed} / {result.processed + result.errors.length}</p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-red-600 font-medium text-sm">Errors ({result.errors.length}):</p>
              {result.errors.slice(0, 10).map((e, i) => <p key={i} className="text-xs text-red-500">Item {e.index}: {e.error}</p>)}
              {result.errors.length > 10 && <p className="text-xs text-slate-400">...and {result.errors.length - 10} more</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
