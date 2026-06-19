import { useState } from "react";
import { useAuth } from "../App";
import { updateProfile } from "../api";
import toast from "react-hot-toast";

export default function StudentProfile() {
  const { user, loginUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {};
      if (name.trim() && name !== user.name) payload.name = name;
      if (email.trim()) payload.email = email;
      if (password.trim()) payload.password = password;
      if (language) payload.language = language;
      if (Object.keys(payload).length === 0) { toast.error("No changes"); setLoading(false); return; }
      const res = await updateProfile(payload);
      loginUser({ ...user, name: res.name });
      toast.success("Profile updated!");
      setPassword("");
      setEmail("");
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Profile</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email (leave blank to keep current)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={user?.email || ""} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New Password (leave blank to keep current)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full border rounded px-3 py-2 bg-white">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="zh">Chinese</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <hr />
        <button type="button" onClick={logout} className="text-red-500 text-sm hover:underline">Logout</button>
      </form>
    </div>
  );
}
