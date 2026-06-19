import axios from "axios";

const client = axios.create({ baseURL: "/api", timeout: 30000 });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `JWT ${token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("name");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const login = (data) => client.post("/login", data).then((r) => r.data);
export const signup = (data) => client.post("/signup", data).then((r) => r.data);
export const getMe = () => client.get("/me").then((r) => r.data);

export const createAssessment = (data) => client.post("/assessments", data).then((r) => r.data);
export const listAssessments = () => client.get("/assessments").then((r) => r.data);
export const getAssessment = (id) => client.get(`/assessments/${id}`).then((r) => r.data);
export const updateAssessment = (id, data) => client.put(`/assessments/${id}`, data).then((r) => r.data);
export const deleteAssessment = (id) => client.delete(`/assessments/${id}`).then((r) => r.data);

export const teacherAssessments = () => client.get("/teacher/assessments").then((r) => r.data);
export const teacherSubmissions = (params) => client.get("/teacher/submissions", { params }).then((r) => r.data);

export const submitToAssessment = (id, data) => client.post(`/assessments/${id}/submit`, data).then((r) => r.data);
export const submitImageToAssessment = (id, formData) =>
  client.post(`/assessments/${id}/submit-image`, formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);

export const studentSubmissions = () => client.get("/student/submissions").then((r) => r.data);
export const studentAssessments = () => client.get("/student/assessments").then((r) => r.data);

export const updateSubmission = (id, data) => client.put(`/submissions/${id}`, data).then((r) => r.data);
export const bulkUpload = (data) => client.post("/bulk-upload", data).then((r) => r.data);

export const assessmentStats = (id) => client.get(`/assessments/${id}/stats`).then((r) => r.data);
export const assessmentSuggestions = (id) => client.get(`/assessments/${id}/suggestions`).then((r) => r.data);

export const exportCsv = async (assessmentId) => {
  const r = await client.get("/export", { params: { assessment_id: assessmentId }, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([r.data]));
  const a = document.createElement("a"); a.href = url; a.download = `assessment_${assessmentId}_results.csv`;
  document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
};

export const studentHistory = () => client.get("/student/history").then((r) => r.data);
export const peerComparison = (id) => client.get(`/assessments/${id}/peer`).then((r) => r.data);
export const getRecommendations = (data) => client.post("/recommend", data).then((r) => r.data);
export const assessmentLeaderboard = (id) => client.get(`/assessments/${id}/leaderboard`).then((r) => r.data);
export const generateQuestion = (data) => client.post("/generate-question", data).then((r) => r.data);
export const submitAudioToAssessment = (id, formData) =>
  client.post(`/assessments/${id}/submit-audio`, formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);

export const updateProfile = (data) => client.put("/me", data).then((r) => r.data);
export const backupData = () => client.get("/backup").then((r) => r.data);
export const clearAll = () => client.delete("/clear-all").then((r) => r.data);
