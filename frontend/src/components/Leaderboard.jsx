import { useState, useEffect } from "react";
import { teacherSubmissions, assessmentStats, listAssessments, assessmentLeaderboard } from "../api";

export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listAssessments().then((d) => {
      setAssessments(d.assessments);
      if (d.assessments.length > 0 && !assessmentId) setAssessmentId(String(d.assessments[0].id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!assessmentId) { setData(null); return; }
    setLoading(true);
    assessmentLeaderboard(parseInt(assessmentId))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assessmentId]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
          <option value="">Select assessment</option>
          {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>
      {!assessmentId ? (
        <div className="bg-white p-8 rounded-lg shadow text-center"><p className="text-slate-500">Select an assessment</p></div>
      ) : loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : !data || !data.leaderboard || data.leaderboard.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center"><p className="text-slate-500">No submissions yet.</p></div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-center p-3 w-16">Rank</th>
                <th className="text-left p-3">Student</th>
                <th className="text-center p-3 w-20">Score</th>
                <th className="text-center p-3">Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.leaderboard.map((item, i) => (
                <tr key={i} className={i === 0 ? "bg-yellow-50" : i === 1 ? "bg-slate-50" : i === 2 ? "bg-orange-50" : ""}>
                  <td className="text-center p-3">
                    <span className={`text-lg font-bold ${i === 0 ? "text-yellow-600" : i === 1 ? "text-slate-500" : i === 2 ? "text-orange-600" : "text-slate-400"}`}>
                      {i === 0 ? "\U0001F947" : i === 1 ? "\U0001F948" : i === 2 ? "\U0001F949" : `#${i + 1}`}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{item.name}</td>
                  <td className={`text-center p-3 font-bold ${item.score >= 90 ? "text-green-600" : item.score >= 70 ? "text-yellow-600" : "text-red-600"}`}>{item.score}</td>
                  <td className="text-center p-3">
                    <span className={`text-sm ${item.badge?.color || "text-slate-500"}`}>
                      {item.badge?.icon || ""} {item.badge?.name || ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
