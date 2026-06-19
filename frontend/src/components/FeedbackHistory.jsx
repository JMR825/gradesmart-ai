import { useState, useEffect } from "react";
import { studentHistory } from "../api";

export default function FeedbackHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentHistory().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Loading history...</p>;
  if (!data || !data.history || data.history.length === 0) return (
    <div className="bg-white p-8 rounded-lg shadow text-center">
      <p className="text-slate-500">No submission history yet. Submit answers to see your progress.</p>
    </div>
  );

  const scores = data.history;
  const maxScore = 100;
  const minScore = Math.max(0, Math.min(...scores.map(s => s.score || 0)) - 10);
  const trendIcon = data.trend === "improving" ? "\u2191 Improving!" : data.trend === "declining" ? "\u2193 Needs practice" : "\u2192 Stable";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Feedback History</h1>
      <div className={`mb-4 p-3 rounded text-sm font-medium ${
        data.trend === "improving" ? "bg-green-50 text-green-700" :
        data.trend === "declining" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"
      }`}>{trendIcon}</div>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="relative h-48 flex items-end gap-2" style={{ paddingBottom: "2rem" }}>
          {scores.map((s, i) => {
            const h = Math.max((s.score || 0) / maxScore * 100, 2);
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-all"
                     style={{ height: h + "%", minHeight: "4px" }}
                     title={`${s.title}: ${s.score}`} />
                <span className="text-[10px] text-slate-400 mt-1 truncate w-full text-center">
                  {s.date ? new Date(s.date).toLocaleDateString(undefined, {month: "short", day: "numeric"}) : ""}
                </span>
                <div className="absolute bottom-8 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {s.score} - {s.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 bg-white p-4 rounded-lg shadow">
        <h2 className="font-semibold mb-2">Score Summary</h2>
        <p>Average: <span className="font-bold text-indigo-600">{Math.round(scores.reduce((a, s) => a + (s.score || 0), 0) / scores.length)}</span></p>
        <p>Best: <span className="font-bold text-green-600">{Math.max(...scores.map(s => s.score || 0))}</span></p>
        <p>Latest: <span className="font-bold text-slate-600">{scores[scores.length - 1].score || 0}</span></p>
      </div>
    </div>
  );
}
