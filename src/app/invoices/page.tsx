"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useCompany } from "@/lib/company-context";
import SearchableContractSelect from "@/components/contract-search-select";

const invoiceTypeLabels: Record<string, string> = { SPECIAL: "专票", NORMAL: "普票", ELECTRONIC: "电子发票", OTHER: "其他" };
const invoiceTypeOptions: Record<string, string> = { SPECIAL: "增值税专用发票", NORMAL: "增值税普通发票", ELECTRONIC: "电子发票", OTHER: "其他" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function InvoicesPage() {
  const { currentCompany } = useCompany();
  const [purchInvoices, setPurchInvoices] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"purchase" | "sales">("sales");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [form, setForm] = useState({
    contractId: "", invoiceNo: "", invoiceDate: todayStr(),
    amount: "", taxAmount: "0", totalAmount: "", taxRate: "13",
    sellerName: "", buyerName: "",
    invoiceType: "SPECIAL", description: "",
  });
  const [error, setError] = useState("");

  // Auto-populate sellerName/buyerName based on selected contract and current company
  useEffect(() => {
    if (!form.contractId) return;
    const contract = contracts.find((c: any) => c.id === form.contractId);
    if (!contract) return;

    if (tab === "purchase") {
      setForm((prev) => ({
        ...prev,
        sellerName: contract.supplierName || contract.supplier?.name || "",
        buyerName: currentCompany?.name || "",
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        sellerName: currentCompany?.name || "",
        buyerName: contract.customerName || contract.customer?.name || "",
      }));
    }
  }, [form.contractId]);

  const fetchData = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        apiFetch(`/api/purchase-invoices?search=${search}`).then(r => r.json()),
        apiFetch(`/api/sales-invoices?search=${search}`).then(r => r.json()),
      ]);
      if (p.success) setPurchInvoices(p.data);
      if (s.success) setSalesInvoices(s.data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const endpoint = tab === "purchase" ? "purchase-contracts" : "sales-contracts";
    apiFetch(`/api/${endpoint}`).then((r) => r.json()).then((j) => {
      if (j.success) setContracts(j.data);
    });
  }, [tab]);

  const openCreate = async () => {
    setEditing(null);
    setForm({
      contractId: contracts[0]?.id || "", invoiceNo: "", invoiceDate: todayStr(),
      amount: "", taxAmount: "0", totalAmount: "", taxRate: "13",
      sellerName: "", buyerName: "",
      invoiceType: "SPECIAL", description: "",
    });
    try {
      const res = await apiFetch("/api/sequence/next?entity=invoice");
      const json = await res.json();
      if (json.success) {
        setForm((prev) => ({ ...prev, invoiceNo: json.data.seq }));
      }
    } catch {}
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const contract = tab === "purchase" ? item.purchaseContract : item.salesContract;
    const totalAmt = Number(item.totalAmount);
    const amt = Number(item.amount);
    const rate = totalAmt > 0 && amt > 0 ? ((totalAmt - amt) / amt * 100).toFixed(1) : "13";
    setForm({
      contractId: contract?.id || "",
      invoiceNo: item.invoiceNo || "",
      invoiceDate: item.invoiceDate ? item.invoiceDate.slice(0, 10) : todayStr(),
      amount: String(item.amount),
      taxAmount: String(item.taxAmount),
      totalAmount: String(item.totalAmount),
      taxRate: rate,
      sellerName: item.sellerName || "",
      buyerName: item.buyerName || "",
      invoiceType: item.invoiceType || "SPECIAL",
      description: item.description || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setError("");
    const total = parseFloat(form.totalAmount) || 0;
    const rate = parseFloat(form.taxRate) || 0;
    const calcAmount = rate > 0 ? total / (1 + rate / 100) : 0;
    const calcTax = total - calcAmount;

    const endpoint = tab === "purchase" ? "purchase-invoices" : "sales-invoices";
    const url = editing ? `/api/${endpoint}/${editing.id}` : `/api/${endpoint}`;
    const method = editing ? "PUT" : "POST";
    const body: any = {
      invoiceDate: form.invoiceDate,
      amount: editing ? parseFloat(form.amount) : parseFloat(calcAmount.toFixed(2)),
      taxAmount: editing ? parseFloat(form.taxAmount) : parseFloat(calcTax.toFixed(2)),
      totalAmount: total,
      sellerName: form.sellerName,
      buyerName: form.buyerName,
      invoiceType: form.invoiceType,
      description: form.description,
    };
    if (form.invoiceNo) body.invoiceNo = form.invoiceNo;
    if (tab === "purchase") {
      body.purchaseContractId = form.contractId;
    } else {
      body.salesContractId = form.contractId;
    }

    try {
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setEditing(null);
        const [p, s] = await Promise.all([
          apiFetch(`/api/purchase-invoices?search=${search}`).then(r => r.json()),
          apiFetch(`/api/sales-invoices?search=${search}`).then(r => r.json()),
        ]);
        if (p.success) setPurchInvoices(p.data);
        if (s.success) setSalesInvoices(s.data);
      } else {
        setError(json.error || "保存失败");
      }
    } catch {
      setError("网络错误");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该发票？")) return;
    const endpoint = tab === "purchase" ? "purchase-invoices" : "sales-invoices";
    const res = await apiFetch(`/api/${endpoint}/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      const [p, s] = await Promise.all([
        apiFetch(`/api/purchase-invoices?search=${search}`).then(r => r.json()),
        apiFetch(`/api/sales-invoices?search=${search}`).then(r => r.json()),
      ]);
      if (p.success) setPurchInvoices(p.data);
      if (s.success) setSalesInvoices(s.data);
    } else alert(json.error || "删除失败");
  };

  const invoices = tab === "purchase" ? purchInvoices : salesInvoices;
  const totalAmount = invoices.reduce((s: number, i: any) => s + i.totalAmount, 0);
  const totalTax = invoices.reduce((s: number, i: any) => s + i.taxAmount, 0);

  if (loading) return <div className="text-muted">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">发票管理</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ 新建发票</button>
      </div>

      <div className="flex gap-2 mb-4">
<button onClick={() => setTab("sales")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "sales" ? "bg-green-100 text-green-800" : "bg-white text-muted border border-border hover:bg-gray-50"}`}>销售发票（{salesInvoices.length}）</button>
<button onClick={() => setTab("purchase")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "purchase" ? "bg-amber-100 text-amber-800" : "bg-white text-muted border border-border hover:bg-gray-50"}`}>采购发票（{purchInvoices.length}）</button>
      </div>

      <div className="mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索发票号码、合同名称、项目、采购包、对方公司..."
          className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex gap-4 mb-4">
        <div className="bg-white px-4 py-2 rounded-lg border border-border text-sm">合计金额：<span className="font-bold">¥{totalAmount.toLocaleString()}</span></div>
        <div className="bg-white px-4 py-2 rounded-lg border border-border text-sm">合计税额：<span className="font-bold">¥{totalTax.toLocaleString()}</span></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-gray-50 text-left text-sm text-muted"><th className="px-4 py-3 font-medium">发票号码</th><th className="px-4 py-3 font-medium">开票日期</th><th className="px-4 py-3 font-medium">不含税金额</th><th className="px-4 py-3 font-medium">税额</th><th className="px-4 py-3 font-medium">价税合计</th><th className="px-4 py-3 font-medium">类型</th><th className="px-4 py-3 font-medium">对方公司</th><th className="px-4 py-3 font-medium">关联合同</th><th className="px-4 py-3 font-medium">操作</th></tr></thead>
          <tbody>
            {invoices.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-muted">暂无发票</td></tr> : (
              invoices.map((i: any) => {
                const contract = tab === "purchase" ? i.purchaseContract : i.salesContract;
                const href = tab === "purchase" ? `/purchase-contracts/${contract?.id}` : `/sales-contracts/${contract?.id}`;
                return (
                  <tr key={i.id} className="border-t border-border hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{i.invoiceNo}</td>
                    <td className="px-4 py-3 text-sm">{new Date(i.invoiceDate).toLocaleDateString("zh-CN")}</td>
                    <td className="px-4 py-3">¥{Number(i.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">¥{Number(i.taxAmount).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">¥{Number(i.totalAmount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{invoiceTypeLabels[i.invoiceType as keyof typeof invoiceTypeLabels] || i.invoiceType}</td>
                    <td className="px-4 py-3 text-sm">{tab === "purchase" ? i.sellerName || "—" : i.buyerName || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={href} className="text-blue-600 hover:underline">
                        {contract ? `${contract.purchasePackage?.project?.name || "?"}/${contract.purchasePackage?.name || "?"}/${contract.contractName}` : "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 flex gap-1">
                      <button onClick={() => openEdit(i)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      <button onClick={() => handleDelete(i.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "编辑" : "新建"}{tab === "purchase" ? "采购发票" : "销售发票"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">合同 *</label>
                <SearchableContractSelect
                  contracts={contracts}
                  value={form.contractId}
                  onChange={(id) => setForm({ ...form, contractId: id })}
                  placeholder="搜索合同..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">发票号码（留空自动生成）</label>
                <input type="text" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="自动生成" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">开票日期 *</label>
                <input type="date" required value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">价税合计 *</label>
                  <input type="number" required value={form.totalAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, totalAmount: v });
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">税率 %</label>
                  <input type="number" value={form.taxRate}
                    onChange={(e) => {
                      setForm({ ...form, taxRate: e.target.value });
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
              </div>
              {(() => {
                const total = parseFloat(form.totalAmount) || 0;
                const rate = parseFloat(form.taxRate) || 0;
                const amt = rate > 0 ? total / (1 + rate / 100) : 0;
                const tax = total - amt;
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">不含税金额</label>
                      <input type="text" readOnly value={amt ? amt.toFixed(2) : ""}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-gray-600" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">税额</label>
                      <input type="text" readOnly value={tax ? tax.toFixed(2) : ""}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-gray-600" />
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">开票方</label>
                  <input type="text" readOnly value={form.sellerName}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">收票方</label>
                  <input type="text" readOnly value={form.buyerName}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-gray-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">发票类型</label>
                <select value={form.invoiceType} onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  {Object.entries(invoiceTypeOptions).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
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
