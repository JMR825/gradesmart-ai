import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAssessment, submitToAssessment, submitImageToAssessment, submitAudioToAssessment } from "../api";
import toast from "react-hot-toast";

export default function SubmitAnswer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [mode, setMode] = useState("text");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [answer, setAnswer] = useState("");
  const [file, setFile] = useState(null);
  const [timer, setTimer] = useState(0);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (id) getAssessment(id).then((a) => {
      setAssessment(a);
      if (a.timer_sec > 0) {
        setTimer(a.timer_sec);
        timerRef.current = setInterval(() => {
          setTimer((t) => {
            if (t <= 1) { clearInterval(timerRef.current); toast.error("Time's up!"); return 0; }
            return t - 1;
          });
        }, 1000);
      }
    }).catch(() => navigate("/student"));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [id]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorder.current = mr;
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setRecording(true);
      toast.success("Recording... Speak your answer");
    } catch (err) {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      let res;
      if (mode === "text") {
        if (!answer.trim()) { toast.error("Enter an answer"); setLoading(false); return; }
        res = await submitToAssessment(id, { answer, answer_type: "text" });
        toast.success("Submitted & graded!");
      } else if (mode === "image") {
        if (!file) { toast.error("Select an image"); setLoading(false); return; }
        const fd = new FormData(); fd.append("file", file);
        res = await submitImageToAssessment(id, fd);
        toast.success("Image submitted & graded!");
      } else {
        if (!audioBlob) { toast.error("Record an audio answer first"); setLoading(false); return; }
        const fd = new FormData(); fd.append("file", audioBlob, "answer.webm");
        res = await submitAudioToAssessment(id, fd);
        toast.success("Audio submitted & graded!");
      }
      setResult(res);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!assessment) return <p className="text-slate-500">Loading assessment...</p>;

  const showTimer = assessment.timer_sec > 0;

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">{assessment.title}</h1>
          <p className="text-slate-600 mb-4">{assessment.question}</p>
          {assessment.practice_mode && (
            <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-medium">Practice Mode</span>
          )}
        </div>
        {showTimer && (
          <div className={`text-2xl font-mono font-bold px-4 py-2 rounded ${timer < 60 ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-100 text-slate-700"}`}>
            {formatTime(timer)}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(assessment.submission_type === "text" || assessment.submission_type === "both") && (
          <button onClick={() => setMode("text")} className={`px-4 py-2 rounded text-sm ${mode === "text" ? "bg-indigo-600 text-white" : "bg-white"}`}>Text</button>
        )}
        {(assessment.submission_type === "image" || assessment.submission_type === "both") && (
          <button onClick={() => setMode("image")} className={`px-4 py-2 rounded text-sm ${mode === "image" ? "bg-indigo-600 text-white" : "bg-white"}`}>Image</button>
        )}
        {(assessment.submission_type === "audio" || assessment.submission_type === "both") && (
          <button onClick={() => setMode("audio")} className={`px-4 py-2 rounded text-sm ${mode === "audio" ? "bg-indigo-600 text-white" : "bg-white"}`}>Audio</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4 max-w-2xl">
        {mode === "text" ? (
          <textarea placeholder="Your Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} className="w-full border rounded px-3 py-2" required={mode === "text"} />
        ) : mode === "image" ? (
          <div>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} className="w-full" required={mode === "image"} />
            {file && <p className="text-xs text-slate-500 mt-1">{file.name}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Record your answer using your microphone:</p>
            <div className="flex gap-2">
              {!recording ? (
                <button type="button" onClick={startRecording} disabled={!!audioBlob} className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 disabled:opacity-50">
                  {audioBlob ? "Recorded" : "\u25CF Start Recording"}
                </button>
              ) : (
                <button type="button" onClick={stopRecording} className="bg-slate-600 text-white px-4 py-2 rounded text-sm hover:bg-slate-700">
                  \u25A0 Stop Recording
                </button>
              )}
              {audioUrl && (
                <div className="flex items-center gap-2">
                  <audio src={audioUrl} controls className="h-8" />
                  <button type="button" onClick={() => { setAudioBlob(null); setAudioUrl(null); }} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              )}
            </div>
            {recording && <p className="text-sm text-red-500 animate-pulse">Recording... Click Stop when done.</p>}
          </div>
        )}
        <button type="submit" disabled={loading || (showTimer && timer === 0)} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Grading..." : showTimer && timer === 0 ? "Time's Up" : "Submit Answer"}
        </button>
      </form>

      {result && (
        <div className="mt-4 bg-white p-6 rounded-lg shadow max-w-2xl">
          <p className="text-lg font-semibold">
            Score: <span className={result.score >= 70 ? "text-green-600" : result.score >= 40 ? "text-yellow-600" : "text-red-600"}>{result.score}</span>
          </p>
          {result.extracted_text && <p className="text-sm text-slate-500 mt-1">Extracted: {result.extracted_text}</p>}
          {result.transcribed_text && <p className="text-sm text-slate-500 mt-1">Transcribed: {result.transcribed_text}</p>}
          <p className="mt-2 text-slate-700 whitespace-pre-line">{result.feedback}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => navigate("/student")} className="text-sm text-indigo-600 hover:underline">Back to Assessments</button>
            <button onClick={() => navigate(`/student/compare/${id}`)} className="text-sm text-indigo-600 hover:underline">Compare with Peers</button>
          </div>
        </div>
      )}
    </div>
  );
}
