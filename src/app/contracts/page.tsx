"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useCompany } from "@/lib/company-context";
import SearchablePackageSelect from "@/components/package-search-select";

interface PurchaseContract {
  id: string; contractNo: string; contractName: string; supplierName: string;
  amount: number; status: string; signedDate: string; description: string | null;
  purchasePackage: { id: string; name: string; code: string; project: { id: string; name: string } };
  _count: { payments: number; invoices: number };
}

interface SalesContract {
  id: string; contractNo: string; contractName: string; customerName: string;
  amount: number; status: string; signedDate: string; description: string | null;
  purchasePackage: { id: string; name: string; code: string; project: { id: string; name: string } };
  _count: { receipts: number; invoices: number };
}

interface Partner {
  id: string; name: string; type: string; contactPerson: string | null; phone: string | null;
}

const statusLabels: Record<string, string> = {
  DRAFT: "草稿", ACTIVE: "执行中", COMPLETED: "已完成", TERMINATED: "已终止",
};
const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700", ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700", TERMINATED: "bg-red-100 text-red-700",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ContractsPage() {
  const { currentCompany } = useCompany();
  const [tab, setTab] = useState<"purchase" | "sales">("sales");
  const [purchaseContracts, setPurchaseContracts] = useState<PurchaseContract[]>([]);
  const [salesContracts, setSalesContracts] = useState<SalesContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    purchasePackageId: "", contractNo: "", contractName: "",
    supplierId: "", supplierName: "", customerId: "", customerName: "",
    amount: "", signedDate: todayStr(), description: "",
  });
  const [packages, setPackages] = useState<any[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const partnerDropdownRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        apiFetch(`/api/purchase-contracts?search=${search}`),
        apiFetch(`/api/sales-contracts?search=${search}`),
      ]);
      const pJson = await pRes.json();
      const sJson = await sRes.json();
      if (pJson.success) setPurchaseContracts(pJson.data);
      if (sJson.success) setSalesContracts(sJson.data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    apiFetch("/api/purchase-packages").then((r) => r.json()).then((j) => {
      if (j.success) setPackages(j.data);
    });
  }, [currentCompany?.id]);

  const fetchPartners = useCallback(async (type: string, q: string) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (q) params.set("search", q);
    const res = await apiFetch(`/api/partners?${params}`);
    const json = await res.json();
    if (json.success) setPartners(json.data);
  }, []);

  useEffect(() => {
    if (!showPartnerDropdown) return;
    const handler = (e: MouseEvent) => {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(e.target as Node)) {
        setShowPartnerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPartnerDropdown]);

  const openCreate = async () => {
    setEditing(null);
    const partnerType = tab === "purchase" ? "SUPPLIER" : "CUSTOMER";
    fetchPartners(partnerType, "");
    setPartnerSearch("");
    setForm({
      purchasePackageId: packages[0]?.id || "", contractNo: "", contractName: "",
      supplierId: "", supplierName: "", customerId: "", customerName: "",
      amount: "", signedDate: todayStr(), description: "",
    });
    // Pre-fetch next contract number
    const entityType = "contract";
    try {
      const res = await apiFetch(`/api/sequence/next?entity=${entityType}`);
      const json = await res.json();
      if (json.success) {
        setForm((prev) => ({ ...prev, contractNo: json.data.seq }));
      }
    } catch {}
    setShowForm(true);
  };

  const openEdit = async (item: any) => {
    setEditing(item);
    const partnerType = tab === "purchase" ? "SUPPLIER" : "CUSTOMER";
    fetchPartners(partnerType, "");
    setPartnerSearch("");

    const partnerId = tab === "purchase" ? item.supplier?.id || "" : item.customer?.id || "";
    const partnerName = tab === "purchase" ? item.supplier?.name || item.supplierName || "" : item.customer?.name || item.customerName || "";
    setForm({
      purchasePackageId: item.purchasePackage?.id || item.purchasePackageId || "",
      contractNo: item.contractNo,
      contractName: item.contractName,
      supplierId: tab === "purchase" ? partnerId : "",
      supplierName: tab === "purchase" ? partnerName : "",
      customerId: tab === "sales" ? partnerId : "",
      customerName: tab === "sales" ? partnerName : "",
      amount: String(item.amount),
      signedDate: item.signedDate ? item.signedDate.slice(0, 10) : todayStr(),
      description: item.description || "",
    });
    setShowForm(true);
  };

  const selectPartner = (partner: Partner) => {
    if (tab === "purchase") {
      setForm({ ...form, supplierId: partner.id, supplierName: partner.name });
    } else {
      setForm({ ...form, customerId: partner.id, customerName: partner.name });
    }
    setShowPartnerDropdown(false);
  };

  const selectedPartner = partners.find((p) =>
    tab === "purchase" ? p.id === form.supplierId : p.id === form.customerId
  );

  const handleSubmit = async () => {
    setError("");
    const endpoint = tab === "purchase" ? "purchase-contracts" : "sales-contracts";
    const url = editing ? `/api/${endpoint}/${editing.id}` : `/api/${endpoint}`;
    const method = editing ? "PUT" : "POST";
    const body: any = {
      purchasePackageId: form.purchasePackageId,
      contractNo: form.contractNo,
      contractName: form.contractName,
      amount: parseFloat(form.amount),
      signedDate: form.signedDate || undefined,
      description: form.description,
    };
    if (tab === "purchase") {
      if (form.supplierId) body.supplierId = form.supplierId;
      else if (selectedPartner) body.supplierId = selectedPartner.id;
      if (form.supplierName) body.supplierName = form.supplierName;
      else if (selectedPartner) body.supplierName = selectedPartner.name;
    } else {
      if (form.customerId) body.customerId = form.customerId;
      else if (selectedPartner) body.customerId = selectedPartner.id;
      if (form.customerName) body.customerName = form.customerName;
      else if (selectedPartner) body.customerName = selectedPartner.name;
    }

    try {
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setEditing(null);
        fetchData();
      } else {
        setError(json.error || "保存失败");
      }
    } catch {
      setError("网络错误");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该合同？")) return;
    const endpoint = tab === "purchase" ? "purchase-contracts" : "sales-contracts";
    const res = await apiFetch(`/api/${endpoint}/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) fetchData();
    else alert(json.error || "删除失败");
  };

  const list = tab === "purchase" ? purchaseContracts : salesContracts;

  if (loading) return <div className="text-muted">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">合同管理</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ 新建合同</button>
      </div>

      <div className="flex gap-1 mb-4">
<button onClick={() => setTab("sales")} className={`px-4 py-2 text-sm rounded-lg ${tab === "sales" ? "bg-green-600 text-white" : "bg-white border border-border hover:bg-gray-50"}`}>销售合同</button>
<button onClick={() => setTab("purchase")} className={`px-4 py-2 text-sm rounded-lg ${tab === "purchase" ? "bg-amber-600 text-white" : "bg-white border border-border hover:bg-gray-50"}`}>采购合同</button>
      </div>

      <div className="mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={`搜索${tab === "purchase" ? "合同编号、名称、供应商、项目、采购包" : "合同编号、名称、客户、项目、采购包"}...`}
          className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-muted">
              <th className="px-4 py-3 font-medium">合同编号</th>
              <th className="px-4 py-3 font-medium">合同名称</th>
              <th className="px-4 py-3 font-medium">{tab === "purchase" ? "供应商" : "客户"}</th>
              <th className="px-4 py-3 font-medium">所属项目</th>
              <th className="px-4 py-3 font-medium">所属采购包</th>
              <th className="px-4 py-3 font-medium">金额</th>
              <th className="px-4 py-3 font-medium">签订日期</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">暂无合同</td></tr>
            ) : (
              list.map((item: any) => (
                <tr key={item.id} className="border-t border-border hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{item.contractNo}</td>
                  <td className="px-4 py-3">
                    <Link href={`/${tab === "purchase" ? "purchase-contracts" : "sales-contracts"}/${item.id}`} className="text-blue-600 hover:underline text-sm">{item.contractName}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{tab === "purchase" ? item.supplierName : item.customerName}</td>
                  <td className="px-4 py-3 text-sm text-muted">{item.purchasePackage?.project?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted">{item.purchasePackage?.name ? `${item.purchasePackage.name}（${item.purchasePackage.code}）` : "—"}</td>
                  <td className="px-4 py-3 text-sm">¥{Number(item.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-muted">{item.signedDate ? new Date(item.signedDate).toLocaleDateString("zh-CN") : "—"}</td>
                  <td className="px-4 py-3 flex gap-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
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
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "编辑合同" : "新建合同"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">所属采购包 *</label>
                <SearchablePackageSelect
                  packages={packages}
                  value={form.purchasePackageId}
                  onChange={(id) => setForm({ ...form, purchasePackageId: id })}
                  placeholder="搜索采购包..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">合同编号 *</label>
                <input type="text" required value={form.contractNo} onChange={(e) => setForm({ ...form, contractNo: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">合同名称 *</label>
                <input type="text" required value={form.contractName} onChange={(e) => setForm({ ...form, contractName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{tab === "purchase" ? "供应商" : "客户"} *</label>
                  <div className="relative" ref={partnerDropdownRef}>
                    <input
                      type="text"
                      value={tab === "purchase" ? (form.supplierName || partnerSearch) : (form.customerName || partnerSearch)}
                      onChange={(e) => {
                        setPartnerSearch(e.target.value);
                        setForm({ ...form, [tab === "purchase" ? "supplierId" : "customerId"]: "", [tab === "purchase" ? "supplierName" : "customerName"]: "" });
                        setShowPartnerDropdown(true);
                        const partnerType = tab === "purchase" ? "SUPPLIER" : "CUSTOMER";
                        fetchPartners(partnerType, e.target.value);
                      }}
                      onFocus={() => {
                        setShowPartnerDropdown(true);
                        const partnerType = tab === "purchase" ? "SUPPLIER" : "CUSTOMER";
                        fetchPartners(partnerType, partnerSearch);
                      }}
                      placeholder={`搜索${tab === "purchase" ? "供应商" : "客户"}...`}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  {showPartnerDropdown && (
                    <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {partners.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted">无匹配结果</div>
                      ) : (
                        partners.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectPartner(p)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between items-center ${
                              (tab === "purchase" ? p.id === form.supplierId : p.id === form.customerId) ? "bg-blue-50" : ""
                            }`}
                          >
                            <span>{p.name}</span>
                            <span className="text-xs text-muted">{p.contactPerson || ""}{p.contactPerson && p.phone ? " / " : ""}{p.phone || ""}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">金额 *</label>
                <input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">签订日期</label>
                <input type="date" value={form.signedDate} onChange={(e) => setForm({ ...form, signedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">备注</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" rows={2} />
              </div>
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
