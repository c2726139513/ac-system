"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useCompany } from "@/lib/company-context";

interface PurchaseContract {
  id: string; contractNo: string; contractName: string; supplierName: string;
  amount: number; signedDate: string | null; status: string; description: string | null;
  totalPaid: number; totalInvoiced: number;
  supplier: { id: string; name: string; contactPerson: string | null; phone: string | null } | null;
  purchasePackage: { id: string; name: string; code: string; project: { id: string; name: string } };
  payments: any[]; invoices: any[];
}

const paymentMethodLabels: Record<string, string> = {
  BANK_TRANSFER: "银行转账", CASH: "现金", CHECK: "支票", OTHER: "其他",
};
const invoiceTypeLabels: Record<string, string> = {
  SPECIAL: "专票", NORMAL: "普票", ELECTRONIC: "电子发票", OTHER: "其他",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PurchaseContractDetailPage() {
  const { currentCompany } = useCompany();
  const params = useParams();
  const [contract, setContract] = useState<PurchaseContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"payments" | "invoices">("payments");
  const [showPayForm, setShowPayForm] = useState(false);
  const [showInvForm, setShowInvForm] = useState(false);
  const [payForm, setPayForm] = useState({ paymentNo: "", amount: "", paymentDate: todayStr(), paymentMethod: "BANK_TRANSFER", description: "" });
  const [invForm, setInvForm] = useState({ invoiceNo: "", invoiceDate: todayStr(), totalAmount: "", taxRate: "13", sellerName: "", buyerName: "", invoiceType: "SPECIAL", description: "" });

  const fetchContract = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/purchase-contracts/${params.id}`);
      const json = await res.json();
      if (json.success) setContract(json.data);
    } finally { setLoading(false); }
  }, [params.id, currentCompany?.id]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  const createPayment = async () => {
    const body: any = { purchaseContractId: params.id, amount: parseFloat(payForm.amount), paymentDate: payForm.paymentDate, paymentMethod: payForm.paymentMethod, description: payForm.description };
    if (payForm.paymentNo) body.paymentNo = payForm.paymentNo;
    const res = await apiFetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.success) { setShowPayForm(false); setPayForm({ paymentNo: "", amount: "", paymentDate: todayStr(), paymentMethod: "BANK_TRANSFER", description: "" }); fetchContract(); }
    else alert(json.error);
  };

  const createInvoice = async () => {
    const total = parseFloat(invForm.totalAmount) || 0;
    const rate = parseFloat(invForm.taxRate) || 0;
    const calcAmount = rate > 0 ? total / (1 + rate / 100) : 0;
    const calcTax = total - calcAmount;
    const body: any = { purchaseContractId: params.id, invoiceDate: invForm.invoiceDate, amount: parseFloat(calcAmount.toFixed(2)), taxAmount: parseFloat(calcTax.toFixed(2)), totalAmount: total, sellerName: invForm.sellerName, buyerName: invForm.buyerName, invoiceType: invForm.invoiceType, description: invForm.description };
    if (invForm.invoiceNo) body.invoiceNo = invForm.invoiceNo;
    const res = await apiFetch("/api/purchase-invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.success) { setShowInvForm(false); setInvForm({ invoiceNo: "", invoiceDate: todayStr(), totalAmount: "", taxRate: "13", sellerName: "", buyerName: "", invoiceType: "SPECIAL", description: "" }); fetchContract(); }
    else alert(json.error);
  };

  if (loading) return <div className="text-muted">加载中...</div>;
  if (!contract) return <div className="text-red-500">合同不存在</div>;

  return (
    <div>
      <div className="mb-4">
        <Link href={`/projects/${contract.purchasePackage.project.id}`} className="text-sm text-blue-600 hover:underline">&larr; 返回项目</Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">{contract.contractName}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted">合同编号：</span>{contract.contractNo}</div>
          <div>
            <span className="text-muted">供应商：</span>
            {contract.supplier ? (
              <span title={`联系人: ${contract.supplier.contactPerson || "-"} | 电话: ${contract.supplier.phone || "-"}`}>{contract.supplier.name}</span>
            ) : contract.supplierName}
          </div>
          <div><span className="text-muted">合同金额：</span><span className="font-medium">¥{contract.amount.toLocaleString()}</span></div>
          <div><span className="text-muted">签订日期：</span>{contract.signedDate ? new Date(contract.signedDate).toLocaleDateString("zh-CN") : "-"}</div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center p-3 bg-amber-50 rounded-lg"><div className="text-lg font-bold text-amber-700">¥{contract.totalPaid.toLocaleString()}</div><div className="text-xs text-muted">已付款</div></div>
          <div className="text-center p-3 bg-blue-50 rounded-lg"><div className="text-lg font-bold text-blue-700">¥{contract.totalInvoiced.toLocaleString()}</div><div className="text-xs text-muted">已取得发票</div></div>
          <div className="text-center p-3 bg-gray-50 rounded-lg"><div className="text-lg font-bold">¥{(contract.amount - contract.totalPaid).toLocaleString()}</div><div className="text-xs text-muted">待付款</div></div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab("payments")} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === "payments" ? "bg-amber-100 text-amber-800" : "bg-white text-muted border border-border hover:bg-gray-50"}`}>付款记录 ({contract.payments.length})</button>
        <button onClick={() => setActiveTab("invoices")} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === "invoices" ? "bg-blue-100 text-blue-800" : "bg-white text-muted border border-border hover:bg-gray-50"}`}>发票 ({contract.invoices.length})</button>
      </div>

      {activeTab === "payments" && (
        <div className="bg-white rounded-xl shadow-sm border border-border">
          <div className="flex justify-between items-center p-4 border-b border-border">
            <span className="font-medium">付款记录</span>
            <button onClick={() => setShowPayForm(true)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">+ 新增付款</button>
          </div>
          {contract.payments.length === 0 ? (
            <p className="text-center text-muted py-8">暂无付款记录</p>
          ) : (
            <table className="w-full">
              <thead><tr className="bg-gray-50 text-left text-sm text-muted"><th className="px-4 py-3 font-medium">编号</th><th className="px-4 py-3 font-medium">金额</th><th className="px-4 py-3 font-medium">付款日期</th><th className="px-4 py-3 font-medium">方式</th><th className="px-4 py-3 font-medium">备注</th></tr></thead>
              <tbody>
                {contract.payments.map((p: any) => (
                  <tr key={p.id} className="border-t border-border"><td className="px-4 py-3 text-sm text-muted">{p.paymentNo || "—"}</td><td className="px-4 py-3 font-medium">¥{Number(p.amount).toLocaleString()}</td><td className="px-4 py-3 text-sm">{new Date(p.paymentDate).toLocaleDateString("zh-CN")}</td><td className="px-4 py-3 text-sm">{paymentMethodLabels[p.paymentMethod] || p.paymentMethod}</td><td className="px-4 py-3 text-sm text-muted">{p.description || "-"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="bg-white rounded-xl shadow-sm border border-border">
          <div className="flex justify-between items-center p-4 border-b border-border">
            <span className="font-medium">发票</span>
            <button onClick={() => { setInvForm({ invoiceNo: "", invoiceDate: todayStr(), totalAmount: "", taxRate: "13", sellerName: contract?.supplier?.name || contract?.supplierName || "", buyerName: currentCompany?.name || "", invoiceType: "SPECIAL", description: "" }); setShowInvForm(true); }} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ 新增发票</button>
          </div>
          {contract.invoices.length === 0 ? (
            <p className="text-center text-muted py-8">暂无发票</p>
          ) : (
            <table className="w-full">
              <thead><tr className="bg-gray-50 text-left text-sm text-muted"><th className="px-4 py-3 font-medium">发票号码</th><th className="px-4 py-3 font-medium">开票日期</th><th className="px-4 py-3 font-medium">不含税金额</th><th className="px-4 py-3 font-medium">税额</th><th className="px-4 py-3 font-medium">价税合计</th><th className="px-4 py-3 font-medium">类型</th></tr></thead>
              <tbody>
                {contract.invoices.map((i: any) => (
                  <tr key={i.id} className="border-t border-border"><td className="px-4 py-3 text-sm">{i.invoiceNo}</td><td className="px-4 py-3 text-sm">{new Date(i.invoiceDate).toLocaleDateString("zh-CN")}</td><td className="px-4 py-3">¥{Number(i.amount).toLocaleString()}</td><td className="px-4 py-3 text-sm">¥{Number(i.taxAmount).toLocaleString()}</td><td className="px-4 py-3 font-medium">¥{Number(i.totalAmount).toLocaleString()}</td><td className="px-4 py-3 text-sm">{invoiceTypeLabels[i.invoiceType as keyof typeof invoiceTypeLabels] || i.invoiceType}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showPayForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">新增付款</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">编号（留空自动生成）</label><input type="text" value={payForm.paymentNo} onChange={(e) => setPayForm({ ...payForm, paymentNo: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="自动生成" /></div>
              <div><label className="block text-sm font-medium mb-1">金额 *</label><input type="number" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">付款日期 *</label><input type="date" required value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">付款方式</label><select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm"><option value="BANK_TRANSFER">银行转账</option><option value="CASH">现金</option><option value="CHECK">支票</option><option value="OTHER">其他</option></select></div>
              <div><label className="block text-sm font-medium mb-1">备注</label><textarea value={payForm.description} onChange={(e) => setPayForm({ ...payForm, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" rows={2} /></div>
              <div className="flex gap-3 justify-end pt-2"><button onClick={() => setShowPayForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button><button onClick={createPayment} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">保存</button></div>
            </div>
          </div>
        </div>
      )}

      {showInvForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">新增发票</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">发票号码（留空自动生成）</label>
                <input type="text" value={invForm.invoiceNo} onChange={(e) => setInvForm({ ...invForm, invoiceNo: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="自动生成" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">开票日期 *</label>
                <input type="date" required value={invForm.invoiceDate} onChange={(e) => setInvForm({ ...invForm, invoiceDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">价税合计 *</label>
                  <input type="number" required value={invForm.totalAmount}
                    onChange={(e) => setInvForm({ ...invForm, totalAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">税率 %</label>
                  <input type="number" value={invForm.taxRate}
                    onChange={(e) => setInvForm({ ...invForm, taxRate: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
              </div>
              {(() => {
                const total = parseFloat(invForm.totalAmount) || 0;
                const rate = parseFloat(invForm.taxRate) || 0;
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
                  <input type="text" readOnly value={invForm.sellerName}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">收票方</label>
                  <input type="text" readOnly value={invForm.buyerName}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-gray-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">发票类型</label>
                <select value={invForm.invoiceType} onChange={(e) => setInvForm({ ...invForm, invoiceType: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  <option value="SPECIAL">增值税专用发票</option>
                  <option value="NORMAL">增值税普通发票</option>
                  <option value="ELECTRONIC">电子发票</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">备注</label>
                <textarea value={invForm.description} onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" rows={2} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowInvForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button>
                <button onClick={createInvoice} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
