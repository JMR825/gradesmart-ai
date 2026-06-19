import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getAssessment, peerComparison } from "../api";

export default function PeerComparison() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [assessment, setAssessment] = useState(null);

  useEffect(() => {
    if (!id) return;
    getAssessment(id).then(setAssessment).catch(() => {});
    peerComparison(id).then(setData).catch(() => {});
  }, [id]);

  if (!id) return <div className="bg-white p-8 rounded-lg shadow text-center"><p className="text-slate-500">Select an assessment to compare.</p></div>;
  if (!data) return <p className="text-slate-500">Loading comparison...</p>;

  const dist = data.distribution || [0, 0, 0, 0];
  const labels = ["Excellent (90+)", "Good (70-89)", "Average (50-69)", "Needs Work (<50)"];
  const colors = ["bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-red-500"];
  const maxCount = Math.max(...dist, 1);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{assessment?.title || "Peer Comparison"}</h1>
      <p className="text-slate-500 text-sm mb-4">Anonymous class distribution</p>
      {data.total > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">{data.my_score}</p>
              <p className="text-sm text-slate-500">Your Score</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{data.percentile}%</p>
              <p className="text-sm text-slate-500">You beat {data.percentile}% of students</p>
            </div>
          </div>
          <hr className="mb-4" />
          <p className="text-sm text-slate-600 mb-2">Class Average: <span className="font-bold">{data.class_avg}</span> | Total: {data.total}</p>
          <div className="space-y-2">
            {labels.map((label, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm w-32 text-right">{label}</span>
                <div className="flex-1 bg-slate-100 rounded h-6 relative">
                  <div className={`h-full rounded ${colors[i]} transition-all`}
                       style={{ width: dist[i] > 0 ? Math.max(dist[i] / maxCount * 100, 4) + "%" : "0%" }} />
                  <span className="absolute left-1 top-0 text-xs leading-6 text-white font-medium drop-shadow">
                    {dist[i] > 0 ? dist[i] : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.total === 0 && (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-slate-500">No peer data available yet.</p>
        </div>
      )}
    </div>
  );
}
