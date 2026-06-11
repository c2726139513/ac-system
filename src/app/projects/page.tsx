"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  createdAt: string;
  _count: { purchasePackages: number };
}

const statusLabels: Record<string, string> = {
  ACTIVE: "进行中",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-700",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiFetch("/api/projects");
      const json = await res.json();
      if (json.success) setProjects(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const filtered = projects.filter(
    (p) =>
      p.name.includes(search) ||
      p.code.includes(search)
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", description: "" });
    setShowForm(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({ name: p.name, code: p.code, description: p.description || "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const url = editing ? `/api/projects/${editing.id}` : "/api/projects";
      const method = editing ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setEditing(null);
        setForm({ name: "", code: "", description: "" });
        fetchProjects();
      } else {
        setError(json.error || "保存失败");
      }
    } catch {
      setError("网络错误");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该项目吗？")) return;
    try {
      const res = await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) fetchProjects();
      else alert(json.error || "删除失败");
    } catch {
      alert("网络错误");
    }
  };

  if (loading) return <div className="text-muted">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">项目管理</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 新建项目
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索项目名称或编码..."
          className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "编辑项目" : "新建项目"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">项目名称 *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">项目编码 *</label>
                <input type="text" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">项目描述</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? "保存" : "创建"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-muted">
              <th className="px-4 py-3 font-medium">项目名称</th>
              <th className="px-4 py-3 font-medium">项目编码</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">采购包数</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">暂无项目</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-blue-600 hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{p.code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[p.status] || "bg-gray-100"}`}>
                      {statusLabels[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{p._count.purchasePackages}</td>
                  <td className="px-4 py-3 text-sm text-muted">{new Date(p.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td className="px-4 py-3 flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
