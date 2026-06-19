import { useState, useEffect } from "react";
import { studentSubmissions, getRecommendations } from "../api";
import toast from "react-hot-toast";

export default function StudyRecommendations() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    studentSubmissions()
      .then((d) => {
        const subs = d.submissions || [];
        if (subs.length === 0) { setLoading(false); setError("No submissions yet. Submit an answer to get recommendations."); return; }
        const latest = subs[0];
        const mistakes = latest.feedback ? [latest.feedback.slice(0, 100)] : [];
        return getRecommendations({ score: latest.score, mistakes, topic: latest.question_text || "" });
      })
      .then((r) => { if (r) setRecs(r.recommendations || []); })
      .catch(() => { setError("Could not load recommendations. Try again later."); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Analyzing your performance...</p>;
  if (error) return <p className="text-slate-500">{error}</p>;
  if (recs.length === 0) return <p className="text-slate-500">No recommendations yet.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Study Recommendations</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-sm text-slate-600 mb-4">Based on your recent performance, here are personalized resources:</p>
        <div className="space-y-3">
          {recs.map((r, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
              <span className="text-lg">{i + 1}.</span>
              <p className="text-sm text-slate-700">{r}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
