"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import SearchableContractSelect from "@/components/contract-search-select";

interface Payment {
  id: string; amount: number; paymentDate: string; paymentMethod: string;
  description: string | null;
  purchaseContract: {
    id: string; contractNo: string; contractName: string; supplierName: string | null;
    purchasePackage: { name: string; code: string; project: { name: string } };
  };
}

interface Receipt {
  id: string; amount: number; receiptDate: string; paymentMethod: string;
  description: string | null;
  salesContract: {
    id: string; contractNo: string; contractName: string; customerName: string | null;
    purchasePackage: { name: string; code: string; project: { name: string } };
  };
}

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: "银行转账", CASH: "现金", CHECK: "支票", OTHER: "其他",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentsReceiptsPage() {
  const [tab, setTab] = useState<"payment" | "receipt">("receipt");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [form, setForm] = useState({ contractId: "", number: "", amount: "", date: todayStr(), description: "" });
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([
        apiFetch(`/api/payments?search=${search}`),
        apiFetch(`/api/receipts?search=${search}`),
      ]);
      const pJson = await pRes.json();
      const rJson = await rRes.json();
      if (pJson.success) setPayments(pJson.data);
      if (rJson.success) setReceipts(rJson.data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const endpoint = tab === "payment" ? "purchase-contracts" : "sales-contracts";
    apiFetch(`/api/${endpoint}`).then((r) => r.json()).then((j) => {
      if (j.success) setContracts(j.data);
    });
  }, [tab]);

  const openCreate = async () => {
    setEditing(null);
    setForm({ contractId: contracts[0]?.id || "", number: "", amount: "", date: todayStr(), description: "" });
    try {
      const res = await apiFetch("/api/sequence/next?entity=transaction");
      const json = await res.json();
      if (json.success) {
        setForm((prev) => ({ ...prev, number: json.data.seq }));
      }
    } catch {}
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const contractId = tab === "payment" ? item.purchaseContract?.id : item.salesContract?.id;
    const dateField = tab === "payment" ? "paymentDate" : "receiptDate";
    const numberField = tab === "payment" ? "paymentNo" : "receiptNo";
    setForm({
      contractId: contractId || "",
      number: item[numberField] || "",
      amount: String(item.amount),
      date: item[dateField] ? item[dateField].slice(0, 10) : todayStr(),
      description: item.description || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setError("");
    const endpoint = tab === "payment" ? "payments" : "receipts";
    const url = editing ? `/api/${endpoint}/${editing.id}` : `/api/${endpoint}`;
    const method = editing ? "PUT" : "POST";
    const body: any = {
      amount: parseFloat(form.amount),
      description: form.description,
    };
    if (tab === "payment") {
      body.purchaseContractId = form.contractId;
      body.paymentDate = form.date;
      if (form.number) body.paymentNo = form.number;
    } else {
      body.salesContractId = form.contractId;
      body.receiptDate = form.date;
      if (form.number) body.receiptNo = form.number;
    }

    try {
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    if (!confirm("确定删除？")) return;
    const endpoint = tab === "payment" ? "payments" : "receipts";
    const res = await apiFetch(`/api/${endpoint}/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) fetchData();
    else alert(json.error || "删除失败");
  };

  const list = tab === "payment" ? payments : receipts;

  if (loading) return <div className="text-muted">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">收付款</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">+ 新建</button>
      </div>

      <div className="flex gap-1 mb-4">
<button onClick={() => setTab("receipt")} className={`px-4 py-2 text-sm rounded-lg ${tab === "receipt" ? "bg-green-600 text-white" : "bg-white border border-border hover:bg-gray-50"}`}>收款记录</button>
<button onClick={() => setTab("payment")} className={`px-4 py-2 text-sm rounded-lg ${tab === "payment" ? "bg-amber-600 text-white" : "bg-white border border-border hover:bg-gray-50"}`}>付款记录</button>
      </div>

      <div className="mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索描述、合同名称、项目、采购包、对方公司..."
          className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-muted">
              <th className="px-4 py-3 font-medium">编号</th>
              <th className="px-4 py-3 font-medium">关联合同</th>
              <th className="px-4 py-3 font-medium">金额</th>
              <th className="px-4 py-3 font-medium">{tab === "payment" ? "付款日期" : "收款日期"}</th>
              <th className="px-4 py-3 font-medium">方式</th>
              <th className="px-4 py-3 font-medium">对方公司</th>
              <th className="px-4 py-3 font-medium">描述</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">暂无记录</td></tr>
            ) : (
              list.map((item: any) => {
                const contract = tab === "payment" ? item.purchaseContract : item.salesContract;
                const dateField = tab === "payment" ? "paymentDate" : "receiptDate";
                const numberField = tab === "payment" ? "paymentNo" : "receiptNo";
                return (
                  <tr key={item.id} className="border-t border-border hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-muted">{item[numberField] || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      {contract ? (
                        <Link href={tab === "payment" ? `/purchase-contracts/${contract.id}` : `/sales-contracts/${contract.id}`} className="text-blue-600 hover:underline">
                          {contract.purchasePackage?.project?.name || "?"}/{contract.purchasePackage?.name || "?"}/{contract.contractName}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">¥{Number(item.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-muted">{item[dateField] ? new Date(item[dateField]).toLocaleDateString("zh-CN") : "—"}</td>
                    <td className="px-4 py-3 text-sm">{methodLabels[item.paymentMethod] || item.paymentMethod}</td>
                    <td className="px-4 py-3 text-sm">{tab === "payment" ? (contract?.supplierName || "—") : (contract?.customerName || "—")}</td>
                    <td className="px-4 py-3 text-sm text-muted max-w-[200px] truncate">{item.description || "—"}</td>
                    <td className="px-4 py-3 flex gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "编辑" : "新建"}{tab === "payment" ? "付款记录" : "收款记录"}</h2>
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
                <label className="block text-sm font-medium mb-1">编号（留空自动生成）</label>
                <input type="text" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="自动生成" />
              </div>
              <div><label className="block text-sm font-medium mb-1">金额 *</label><input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">{tab === "payment" ? "付款日期" : "收款日期"} *</label><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">描述</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
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
