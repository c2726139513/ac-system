"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

interface Partner {
  id: string; name: string; type: string; contactPerson: string | null;
  phone: string | null; email: string | null; address: string | null;
  notes: string | null; active: boolean;
}

const typeLabels: Record<string, string> = {
  SUPPLIER: "供应商", CUSTOMER: "客户", BOTH: "供应商+客户",
};
const typeColors: Record<string, string> = {
  SUPPLIER: "bg-blue-100 text-blue-700", CUSTOMER: "bg-green-100 text-green-700",
  BOTH: "bg-purple-100 text-purple-700",
};

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState({
    name: "", type: "SUPPLIER", contactPerson: "", phone: "", email: "", address: "", notes: "",
  });
  const [error, setError] = useState("");

  const fetchPartners = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      const res = await apiFetch(`/api/partners?${params}`);
      const json = await res.json();
      if (json.success) setPartners(json.data);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", type: "SUPPLIER", contactPerson: "", phone: "", email: "", address: "", notes: "" });
    setShowForm(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name, type: p.type, contactPerson: p.contactPerson || "",
      phone: p.phone || "", email: p.email || "", address: p.address || "", notes: p.notes || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.name) { setError("名称为必填项"); return; }
    const url = editing ? `/api/partners/${editing.id}` : "/api/partners";
    const method = editing ? "PUT" : "POST";
    try {
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (json.success) { setShowForm(false); setEditing(null); fetchPartners(); }
      else setError(json.error || "保存失败");
    } catch { setError("网络错误"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该伙伴？")) return;
    const res = await apiFetch(`/api/partners/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) fetchPartners();
    else alert(json.error || "删除失败");
  };

  if (loading) return <div className="text-muted">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">伙伴管理</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ 新建伙伴</button>
      </div>

      <div className="flex gap-2 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索名称、联系人、电话..."
          className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="">全部类型</option>
          <option value="SUPPLIER">供应商</option>
          <option value="CUSTOMER">客户</option>
          <option value="BOTH">供应商+客户</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-muted">
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">联系人</th>
              <th className="px-4 py-3 font-medium">电话</th>
              <th className="px-4 py-3 font-medium">邮箱</th>
              <th className="px-4 py-3 font-medium">地址</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">暂无伙伴</td></tr>
            ) : (
              partners.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                  <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeColors[p.type]}`}>{typeLabels[p.type]}</span></td>
                  <td className="px-4 py-3 text-sm text-muted">{p.contactPerson || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted">{p.phone || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted">{p.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted max-w-[150px] truncate">{p.address || "—"}</td>
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

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "编辑伙伴" : "新建伙伴"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-sm font-medium mb-1">名称 *</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">类型 *</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm"><option value="SUPPLIER">供应商</option><option value="CUSTOMER">客户</option><option value="BOTH">供应商+客户</option></select></div>
              <div><label className="block text-sm font-medium mb-1">联系人</label><input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">电话</label><input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">邮箱</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div className="col-span-2"><label className="block text-sm font-medium mb-1">地址</label><input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div className="col-span-2"><label className="block text-sm font-medium mb-1">备注</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" rows={2} /></div>
              {error && <p className="col-span-2 text-red-500 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 justify-end pt-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleSubmit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? "保存" : "创建"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
