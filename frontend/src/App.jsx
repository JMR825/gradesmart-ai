import { createContext, useContext, useState, useEffect } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./components/Login";
import StudentDashboard from "./components/StudentDashboard";
import SubmitAnswer from "./components/SubmitAnswer";
import ViewResults from "./components/ViewResults";
import StudentProfile from "./components/StudentProfile";
import TeacherDashboard from "./components/TeacherDashboard";
import CreateAssessment from "./components/CreateAssessment";
import AssessmentView from "./components/AssessmentView";
import EditAssessment from "./components/EditAssessment";
import GradeEditor from "./components/GradeEditor";
import BulkUpload from "./components/BulkUpload";
import ExportCSV from "./components/ExportCSV";
import ComparisonChart from "./components/ComparisonChart";
import SmartSuggestions from "./components/SmartSuggestions";
import FeedbackHistory from "./components/FeedbackHistory";
import PeerComparison from "./components/PeerComparison";
import StudyRecommendations from "./components/StudyRecommendations";
import Leaderboard from "./components/Leaderboard";

export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return { token, role: localStorage.getItem("role") };
  });

  const loginUser = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    setUser({ token: data.token, role: data.role, name: data.name, user_id: data.user_id });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setUser(null);
  };

  useEffect(() => {
    if (user && !user.name) {
      import("./api").then(({ getMe }) => {
        getMe().then((d) => setUser((prev) => ({ ...prev, name: d.name, user_id: d.id }))).catch(() => logout());
      });
    }
  }, [user?.token]);

  return (
    <AuthContext.Provider value={{ user, loginUser, logout }}>
      <div className="min-h-screen bg-slate-100">
        <Toaster position="top-right" />
        {user && (
          <nav className="bg-white shadow-sm border-b px-6 py-3 flex items-center gap-6">
            <span className="text-xl font-bold text-indigo-600">GradeSmart AI</span>
            {user.role === "teacher" ? (
              <>
                <NavLink to="/teacher" end className="text-sm font-medium text-slate-600 hover:text-indigo-600">Dashboard</NavLink>
                <NavLink to="/teacher/create" className="text-sm font-medium text-slate-600 hover:text-indigo-600">New Assessment</NavLink>
                <NavLink to="/teacher/editor" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Grade Editor</NavLink>
                <NavLink to="/teacher/bulk" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Bulk</NavLink>
                <NavLink to="/teacher/export" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Export</NavLink>
                <NavLink to="/teacher/chart" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Chart</NavLink>
                <NavLink to="/teacher/suggestions" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Suggestions</NavLink>
                <NavLink to="/teacher/leaderboard" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Leaderboard</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/student" end className="text-sm font-medium text-slate-600 hover:text-indigo-600">Assessments</NavLink>
                <NavLink to="/student/results" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Results</NavLink>
                <NavLink to="/student/history" className="text-sm font-medium text-slate-600 hover:text-indigo-600">History</NavLink>
                <NavLink to="/student/recommendations" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Study Tips</NavLink>
                <NavLink to="/student/profile" className="text-sm font-medium text-slate-600 hover:text-indigo-600">Profile</NavLink>
              </>
            )}
            <span className="ml-auto text-sm text-slate-400">{user.name} ({user.role})</span>
            <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
          </nav>
        )}
        <main className="p-6 max-w-5xl mx-auto">
          <Routes>
            <Route path="/login" element={user ? <Navigate to={user.role === "teacher" ? "/teacher" : "/student"} /> : <Login />} />
            <Route path="/teacher" element={<Protected role="teacher"><TeacherDashboard /></Protected>} />
            <Route path="/teacher/create" element={<Protected role="teacher"><CreateAssessment /></Protected>} />
            <Route path="/teacher/assessment/:id" element={<Protected role="teacher"><AssessmentView /></Protected>} />
            <Route path="/teacher/assessment/:id/edit" element={<Protected role="teacher"><EditAssessment /></Protected>} />
            <Route path="/teacher/editor" element={<Protected role="teacher"><GradeEditor /></Protected>} />
            <Route path="/teacher/bulk" element={<Protected role="teacher"><BulkUpload /></Protected>} />
            <Route path="/teacher/export" element={<Protected role="teacher"><ExportCSV /></Protected>} />
            <Route path="/teacher/chart" element={<Protected role="teacher"><ComparisonChart /></Protected>} />
            <Route path="/teacher/suggestions" element={<Protected role="teacher"><SmartSuggestions /></Protected>} />
            <Route path="/student" element={<Protected role="student"><StudentDashboard /></Protected>} />
            <Route path="/student/submit/:id" element={<Protected role="student"><SubmitAnswer /></Protected>} />
            <Route path="/student/results" element={<Protected role="student"><ViewResults /></Protected>} />
            <Route path="/student/profile" element={<Protected role="student"><StudentProfile /></Protected>} />
            <Route path="/student/history" element={<Protected role="student"><FeedbackHistory /></Protected>} />
            <Route path="/student/compare/:id" element={<Protected role="student"><PeerComparison /></Protected>} />
            <Route path="/student/recommendations" element={<Protected role="student"><StudyRecommendations /></Protected>} />
            <Route path="/teacher/leaderboard" element={<Protected role="teacher"><Leaderboard /></Protected>} />
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
  );
}
