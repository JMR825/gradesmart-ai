import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { studentAssessments } from "../api";

export default function StudentDashboard() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentAssessments().then((d) => setAssessments(d.assessments)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Your Assessments</h1>
      {assessments.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-slate-500">No assessments available yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {assessments.map((a) => (
            <div key={a.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
              <div>
                <p className="text-lg font-medium">{a.title}</p>
                <p className="text-sm text-slate-500 mt-1">{a.question.slice(0, 120)}</p>
                <div className="flex gap-4 mt-1 text-xs text-slate-400">
                  <span>Max: {a.max_score}</span>
                  {a.deadline && <span>Due: {a.deadline}</span>}
                  {a.submitted && <span className="text-green-600 font-medium">Submitted</span>}
                  {a.timer_sec > 0 && <span>Timer: {Math.floor(a.timer_sec / 60)}:{String(a.timer_sec % 60).padStart(2, '0')}</span>}
                </div>
              </div>
              {a.submitted ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 font-medium">Done</span>
                  <Link to={`/student/compare/${a.id}`} className="text-xs text-indigo-500 hover:underline">Compare</Link>
                </div>
              ) : (
                <Link to={`/student/submit/${a.id}`} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">Submit</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
