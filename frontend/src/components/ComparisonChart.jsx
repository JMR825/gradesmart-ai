import { useState, useEffect } from "react";
import { teacherSubmissions, assessmentStats, listAssessments } from "../api";

export default function ComparisonChart() {
  const [subs, setSubs] = useState([]);
  const [stats, setStats] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAssessments().then((d) => {
      setAssessments(d.assessments);
      if (d.assessments.length > 0 && !assessmentId) setAssessmentId(String(d.assessments[0].id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!assessmentId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([teacherSubmissions({ assessment_id: parseInt(assessmentId), per_page: 200 }), assessmentStats(parseInt(assessmentId))])
      .then(([s, st]) => { setSubs(s.submissions || []); setStats(st); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assessmentId]);

  const color = (score) => score >= 90 ? "bg-green-500" : score >= 70 ? "bg-yellow-500" : score >= 50 ? "bg-orange-500" : "bg-red-500";

  if (loading) return <p className="text-slate-500">Loading chart...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Class Performance</h1>
        <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
          <option value="">Select an assessment</option>
          {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>
      {!assessmentId ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-slate-500">Select an assessment to view performance.</p>
        </div>
      ) : subs.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-slate-500">No submissions yet for this assessment.</p>
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <p className="text-lg">Class Average: <span className="font-bold text-indigo-600">{stats?.average_score || 0}</span> / 100</p>
            <p className="text-sm text-slate-500">Min: {stats?.min_score} | Max: {stats?.max_score} | Total: {stats?.total_graded}</p>
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="text-center p-3 bg-green-50 rounded"><p className="text-xl font-bold text-green-600">{stats?.excellent || 0}</p><p className="text-xs text-green-700">A</p></div>
              <div className="text-center p-3 bg-yellow-50 rounded"><p className="text-xl font-bold text-yellow-600">{stats?.good || 0}</p><p className="text-xs text-yellow-700">B</p></div>
              <div className="text-center p-3 bg-orange-50 rounded"><p className="text-xl font-bold text-orange-600">{stats?.average || 0}</p><p className="text-xs text-orange-700">C</p></div>
              <div className="text-center p-3 bg-red-50 rounded"><p className="text-xl font-bold text-red-600">{stats?.poor || 0}</p><p className="text-xs text-red-700">D/F</p></div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="font-semibold mb-3">Individual Scores vs Class Average</h2>
            <div className="space-y-2">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-sm w-24 truncate" title={s.student_name}>{s.student_name}</span>
                  <div className="flex-1 bg-slate-100 rounded h-6 relative">
                    <div className={`h-full rounded ${color(s.score)}`} style={{ width: `${Math.min(s.score, 100)}%` }} />
                    <span className="absolute right-1 top-0 text-xs leading-6 text-slate-600">{s.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
