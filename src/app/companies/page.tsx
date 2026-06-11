"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { useCompany } from "@/lib/company-context";

export default function CompaniesPage() {
  const { companies, refresh, currentCompany, setCurrentCompany } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", taxId: "", address: "", phone: "", bankName: "", bankAccount: "",
  });
  const [error, setError] = useState("");

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", taxId: "", address: "", phone: "", bankName: "", bankAccount: "" });
    setShowForm(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name, taxId: c.taxId || "", address: c.address || "",
      phone: c.phone || "", bankName: c.bankName || "", bankAccount: c.bankAccount || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.name) { setError("公司名称不能为空"); return; }
    const url = editing ? `/api/companies/${editing.id}` : "/api/companies";
    const method = editing ? "PUT" : "POST";
    try {
      const res = await apiFetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        await refresh();
      } else {
        setError(json.error || "保存失败");
      }
    } catch { setError("网络错误"); }
  };

  const handleSetDefault = async (id: string) => {
    await apiFetch(`/api/companies/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该公司？")) return;
    await apiFetch(`/api/companies/${id}`, { method: "DELETE" });
    await refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">公司管理</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ 新建公司</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-muted">
              <th className="px-4 py-3 font-medium">公司名称</th>
              <th className="px-4 py-3 font-medium">税号</th>
              <th className="px-4 py-3 font-medium">默认</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">暂无公司</td></tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className={`border-t border-border hover:bg-gray-50 ${c.id === currentCompany?.id ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-muted">{c.taxId || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.isDefault ? <span className="text-green-600 font-medium">默认</span> : (
                      <button onClick={() => handleSetDefault(c.id)} className="text-xs text-blue-600 hover:underline">设为默认</button>
                    )}
                  </td>
                  <td className="px-4 py-3 flex gap-1 items-center">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button onClick={() => setCurrentCompany(c)} className={`text-xs ${c.id === currentCompany?.id ? "text-green-600 font-medium" : "text-gray-600 hover:text-blue-600"} hover:underline`}>切换</button>
                    {!c.isDefault && <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "编辑公司" : "新建公司"}</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">公司名称 *</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">税号</label><input type="text" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">地址</label><input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">电话</label><input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">开户行</label><input type="text" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">银行账号</label><input type="text" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button>
                <button onClick={handleSubmit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? "保存" : "创建"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
