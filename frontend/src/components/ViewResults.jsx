import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { studentSubmissions } from "../api";

export default function ViewResults() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentSubmissions().then((d) => setSubmissions(d.submissions)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Your Results</h1>
      {submissions.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-slate-500">No submissions yet. Submit an answer to an assessment to see results.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => (
            <div key={s.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{s.question_text.slice(0, 100)}</p>
                  <p className="text-xs text-slate-400 mt-1">Submitted: {new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-lg font-bold ${s.score >= 70 ? "text-green-600" : s.score >= 40 ? "text-yellow-600" : "text-red-600"}`}>{s.score}</span>
              {s.score >= 90 && <span className="text-xs ml-2">🏆</span>}
              {s.score >= 70 && s.score < 90 && <span className="text-xs ml-2">👍</span>}
              </div>
              <p className="text-sm text-slate-600 mt-2">{s.feedback}</p>
              {s.assessment_id && (
                <Link to={`/student/compare/${s.assessment_id}`} className="text-xs text-indigo-500 hover:underline mt-2 inline-block">Compare with peers</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
