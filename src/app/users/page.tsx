"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

interface User {
  id: string;
  username: string;
  name: string;
  roleId: string;
  roleName: string;
  active: boolean;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  permissionLabels: string[];
  userCount: number;
}

const ALL_MODULES = [
  { key: "projects", label: "项目管理" },
  { key: "purchase-packages", label: "采购包管理" },
  { key: "purchase-contracts", label: "采购合同" },
  { key: "sales-contracts", label: "销售合同" },
  { key: "payments", label: "付款记录" },
  { key: "receipts", label: "收款记录" },
  { key: "invoices", label: "发票管理" },
  { key: "users", label: "用户管理" },
  { key: "partners", label: "伙伴管理" },
  { key: "companies", label: "公司管理" },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "roles">("users");

  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: "", password: "", name: "", roleId: "" });

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissions: [] as string[] });

  const fetchData = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        apiFetch("/api/users"),
        apiFetch("/api/roles"),
      ]);
      const uJson = await uRes.json();
      const rJson = await rRes.json();
      if (uJson.success) setUsers(uJson.data);
      if (rJson.success) setRoles(rJson.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveUser = async () => {
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      const body: any = { ...userForm };
      if (editingUser && !body.password) delete body.password;
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setShowUserForm(false);
        setEditingUser(null);
        setUserForm({ username: "", password: "", name: "", roleId: "" });
        fetchData();
      } else {
        alert(json.error || "保存失败");
      }
    } catch {
      alert("网络错误");
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("确定删除该用户？")) return;
    const res = await apiFetch(`/api/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) fetchData();
    else alert(json.error || "删除失败");
  };

  const toggleUserActive = async (user: User) => {
    const res = await apiFetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    const json = await res.json();
    if (json.success) fetchData();
  };

  const saveRole = async () => {
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
      const method = editingRole ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowRoleForm(false);
        setEditingRole(null);
        setRoleForm({ name: "", description: "", permissions: [] });
        fetchData();
      } else {
        alert(json.error || "保存失败");
      }
    } catch {
      alert("网络错误");
    }
  };

  const deleteRole = async (id: string) => {
    if (!confirm("确定删除该角色？")) return;
    const res = await apiFetch(`/api/roles/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) fetchData();
    else alert(json.error || "删除失败");
  };

  const togglePermission = (perm: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  if (loading) return <div className="text-muted">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
      </div>

      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab("users")} className={`px-4 py-2 text-sm rounded-lg ${tab === "users" ? "bg-blue-600 text-white" : "bg-white border border-border hover:bg-gray-50"}`}>用户列表</button>
        <button onClick={() => setTab("roles")} className={`px-4 py-2 text-sm rounded-lg ${tab === "roles" ? "bg-blue-600 text-white" : "bg-white border border-border hover:bg-gray-50"}`}>角色管理</button>
      </div>

      {tab === "users" && (
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <span className="text-sm text-muted">共 {users.length} 个用户</span>
            <button onClick={() => { setEditingUser(null); setUserForm({ username: "", password: "", name: "", roleId: roles[0]?.id || "" }); setShowUserForm(true); }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ 新建用户</button>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50 text-left text-sm text-muted">
              <th className="px-4 py-3 font-medium">用户名</th>
              <th className="px-4 py-3 font-medium">姓名</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{u.username}</td>
                  <td className="px-4 py-3 text-sm">{u.name}</td>
                  <td className="px-4 py-3 text-sm">{u.roleName}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{u.active ? "启用" : "禁用"}</span></td>
                  <td className="px-4 py-3 text-sm text-muted">{new Date(u.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td className="px-4 py-3 flex gap-1 items-center">
                    <button onClick={() => { setEditingUser(u); setUserForm({ username: u.username, password: "", name: u.name, roleId: u.roleId }); setShowUserForm(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button onClick={() => toggleUserActive(u)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors" title={u.active ? "禁用" : "启用"}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{u.active ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}</svg>
                    </button>
                    <button onClick={() => deleteUser(u.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "roles" && (
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <span className="text-sm text-muted">共 {roles.length} 个角色</span>
            <button onClick={() => { setEditingRole(null); setRoleForm({ name: "", description: "", permissions: [] }); setShowRoleForm(true); }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ 新建角色</button>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50 text-left text-sm text-muted">
              <th className="px-4 py-3 font-medium">角色名称</th>
              <th className="px-4 py-3 font-medium">描述</th>
              <th className="px-4 py-3 font-medium">权限</th>
              <th className="px-4 py-3 font-medium">用户数</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr></thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-sm text-muted">{r.description || "—"}</td>
                  <td className="px-4 py-3 text-xs flex flex-wrap gap-1">
                    {r.permissionLabels.length > 0
                      ? r.permissionLabels.map((pl) => <span key={pl} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{pl}</span>)
                      : <span className="text-muted">全部权限</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">{r.userCount}</td>
                  <td className="px-4 py-3 flex gap-1">
                    <button onClick={() => { setEditingRole(r); setRoleForm({ name: r.name, description: r.description || "", permissions: r.permissions }); setShowRoleForm(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button onClick={() => deleteRole(r.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUserForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editingUser ? "编辑用户" : "新建用户"}</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">用户名 *</label><input type="text" required value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">密码 {editingUser ? "(留空不修改)" : "*"}</label><input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">姓名 *</label><input type="text" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">角色 *</label>
                <select value={userForm.roleId} onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  <option value="">请选择</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowUserForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button>
                <button onClick={saveUser} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingUser ? "保存" : "创建"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRoleForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editingRole ? "编辑角色" : "新建角色"}</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">角色名称 *</label><input type="text" required value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">描述</label><input type="text" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">模块权限</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {ALL_MODULES.map((m) => (
                    <label key={m.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={roleForm.permissions.includes(m.key)} onChange={() => togglePermission(m.key)} className="rounded" />
                      {m.label}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" checked={roleForm.permissions.length === 0} onChange={() => setRoleForm({ ...roleForm, permissions: [] })} className="rounded" />
                    全部权限（管理员）
                  </label>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowRoleForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button>
                <button onClick={saveRole} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingRole ? "保存" : "创建"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
