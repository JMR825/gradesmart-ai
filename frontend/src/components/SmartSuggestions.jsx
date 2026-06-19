import { useState, useEffect } from "react";
import { assessmentSuggestions, listAssessments } from "../api";

export default function SmartSuggestions() {
  const [data, setData] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    listAssessments().then((d) => {
      setAssessments(d.assessments);
      if (d.assessments.length > 0 && !assessmentId) setAssessmentId(String(d.assessments[0].id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!assessmentId) { setData(null); return; }
    setLoading(true);
    assessmentSuggestions(parseInt(assessmentId))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assessmentId]);

  if (!assessmentId) return <div><h1 className="text-2xl font-bold mb-4">Smart Suggestions</h1><p className="text-slate-500">Select an assessment to view suggestions.</p></div>;
  if (loading) return <p className="text-slate-500">Analyzing submissions...</p>;

  const mistakes = data?.common_mistakes || [];
  const displayed = showAll ? mistakes : mistakes.slice(0, 5);
  const totalAffected = mistakes.reduce((s, m) => s + m.count, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Smart Suggestions</h1>
        <select value={assessmentId} onChange={(e) => { setAssessmentId(e.target.value); setShowAll(false); }} className="border rounded px-3 py-1.5 text-sm bg-white">
          <option value="">Select an assessment</option>
          {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>
      {mistakes.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-slate-500">No patterns detected yet. Grade more submissions to get suggestions.</p>
        </div>
      ) : (
        <>
          <p className="text-slate-600 mb-4">{totalAffected} students struggling across {mistakes.length} common patterns.</p>
          <div className="space-y-3">
            {displayed.map((m, i) => (
              <div key={i} className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-400">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-amber-800">{m.concept}</p>
                    <p className="text-sm text-slate-600 mt-1">"{m.answer}"</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">{m.count} student{m.count > 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
          {mistakes.length > 5 && (
            <button onClick={() => setShowAll(!showAll)} className="mt-4 text-indigo-600 text-sm hover:underline">
              {showAll ? "Show Less" : `View All (${mistakes.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
