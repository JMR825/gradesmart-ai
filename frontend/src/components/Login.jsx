import { useState } from "react";
import { useAuth } from "../App";
import { login, signup } from "../api";
import toast from "react-hot-toast";

export default function Login() {
  const { loginUser } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", role: "student", name: "" });
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = mode === "login" ? await login({ email: form.email, password: form.password, role: form.role })
        : await signup({ email: form.email, password: form.password, role: form.role, name: form.name });
      loginUser(res);
      toast.success(`Welcome, ${res.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <h1 className="text-2xl font-bold text-center mb-6">GradeSmart AI</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex mb-4 bg-slate-100 rounded">
          <button onClick={() => setMode("login")} className={`flex-1 py-2 text-sm rounded ${mode === "login" ? "bg-indigo-600 text-white" : "text-slate-600"}`}>Login</button>
          <button onClick={() => setMode("signup")} className={`flex-1 py-2 text-sm rounded ${mode === "signup" ? "bg-indigo-600 text-white" : "text-slate-600"}`}>Sign Up</button>
        </div>
        <form onSubmit={handle} className="space-y-3">
          {mode === "signup" && (
            <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
          )}
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border rounded px-3 py-2 bg-white">
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>
        {/* Demo credentials removed for security */}
      </div>
    </div>
  );
}
