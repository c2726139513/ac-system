"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadySetup, setAlreadySetup] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data.needsSetup === false) {
          setAlreadySetup(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (alreadySetup) {
      router.push("/login");
    }
  }, [alreadySetup, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, name }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/login");
      } else {
        setError(json.error || "初始化失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-muted">检查系统状态...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">系统初始化</h1>
          <p className="text-sm text-muted mt-1">创建第一个管理员账户</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">姓名</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入管理员姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">用户名</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入登录用户名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入密码"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "创建中..." : "创建管理员"}
          </button>
        </form>
      </div>
    </div>
  );
}
