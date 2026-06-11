"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface Project {
  id: string; name: string; code: string;
  description: string | null; status: string;
  purchasePackages: PurchasePackage[];
}

interface PurchasePackage {
  id: string; name: string; code: string;
  description: string | null; amount: number; status: string;
  purchaseContracts: PurchaseContract[];
  salesContracts: SalesContract[];
}

interface PurchaseContract {
  id: string; contractNo: string; contractName: string;
  amount: number; status: string;
  supplier: { id: string; name: string } | null;
  supplierName?: string;
  totalPaid: number; totalInvoiced: number;
}

interface SalesContract {
  id: string; contractNo: string; contractName: string;
  amount: number; status: string;
  customer: { id: string; name: string } | null;
  customerName?: string;
  totalReceived: number; totalInvoiced: number;
}

const statusLabels: Record<string, string> = {
  ACTIVE: "进行中", COMPLETED: "已完成", ARCHIVED: "已归档",
  DRAFT: "草稿", TERMINATED: "已终止",
};
const contractStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700", ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700", TERMINATED: "bg-red-100 text-red-700",
};
const packageStatusLabels: Record<string, string> = {
  DRAFT: "草稿", ACTIVE: "进行中", COMPLETED: "已完成", CANCELLED: "已取消",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProjectDetailPage() {
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PurchasePackage | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: "", code: "", description: "", amount: "" });
  const [showPurchForm, setShowPurchForm] = useState<string | null>(null);
  const [showSalesForm, setShowSalesForm] = useState<string | null>(null);
  const [contractForm, setContractForm] = useState({
    contractNo: "", contractName: "", supplierId: "", supplierName: "",
    customerId: "", customerName: "", amount: "", signedDate: "", description: "",
  });
  const [editingContract, setEditingContract] = useState<{ id: string; type: "purchase" | "sales" } | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchInput, setCustomerSearchInput] = useState("");

  const fetchProject = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/projects/${params.id}`);
      const json = await res.json();
      if (json.success) setProject(json.data);
    } finally { setLoading(false); }
  }, [params.id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    apiFetch("/api/partners?type=SUPPLIER").then(r => r.json()).then(j => { if (j.success) setSuppliers(j.data); });
    apiFetch("/api/partners?type=CUSTOMER").then(r => r.json()).then(j => { if (j.success) setCustomers(j.data); });
  }, []);

  const savePackage = async () => {
    const url = editingPkg ? `/api/purchase-packages/${editingPkg.id}` : "/api/purchase-packages";
    const method = editingPkg ? "PUT" : "POST";
    try {
      const res = await apiFetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pkgForm, projectId: params.id, amount: parseFloat(pkgForm.amount) || 0 }),
      });
      const json = await res.json();
      if (json.success) {
        setShowPkgForm(false); setEditingPkg(null);
        setPkgForm({ name: "", code: "", description: "", amount: "" });
        fetchProject();
      } else alert(json.error || "保存失败");
    } catch { alert("网络错误"); }
  };

  const deletePackage = async (id: string) => {
    if (!confirm("确定删除该采购包？")) return;
    const res = await apiFetch(`/api/purchase-packages/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) fetchProject(); else alert(json.error || "删除失败");
  };

  const saveContract = async (pkgId: string, type: "purchase" | "sales") => {
    const endpoint = type === "purchase" ? "purchase-contracts" : "sales-contracts";
    const url = editingContract ? `/api/${endpoint}/${editingContract.id}` : `/api/${endpoint}`;
    const method = editingContract ? "PUT" : "POST";
    const body: any = {
      purchasePackageId: pkgId,
      contractNo: contractForm.contractNo,
      contractName: contractForm.contractName,
      amount: parseFloat(contractForm.amount),
      signedDate: contractForm.signedDate || undefined,
      description: contractForm.description,
    };
    if (type === "purchase") {
      body.supplierId = contractForm.supplierId || null;
      body.supplierName = contractForm.supplierName;
    } else {
      body.customerId = contractForm.customerId || null;
      body.customerName = contractForm.customerName;
    }

    try {
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setShowPurchForm(null); setShowSalesForm(null); setEditingContract(null);
        setContractForm({ contractNo: "", contractName: "", supplierId: "", supplierName: "", customerId: "", customerName: "", amount: "", signedDate: "", description: "" });
        fetchProject();
      } else alert(json.error || "保存失败");
    } catch { alert("网络错误"); }
  };

  const deleteContract = async (id: string, type: "purchase" | "sales") => {
    if (!confirm("确定删除该合同？")) return;
    const endpoint = type === "purchase" ? "purchase-contracts" : "sales-contracts";
    const res = await apiFetch(`/api/${endpoint}/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) fetchProject(); else alert(json.error || "删除失败");
  };

  const openContractForm = (pkgId: string, type: "purchase" | "sales", existing?: any) => {
    if (existing) {
      setEditingContract({ id: existing.id, type });
      const partnerName = type === "purchase"
        ? (existing.supplier?.name || existing.supplierName || "")
        : (existing.customer?.name || existing.customerName || "");
      setContractForm({
        contractNo: existing.contractNo,
        contractName: existing.contractName,
        supplierId: existing.supplier?.id || "",
        supplierName: existing.supplier?.name || existing.supplierName || "",
        customerId: existing.customer?.id || "",
        customerName: existing.customer?.name || existing.customerName || "",
        amount: String(existing.amount),
        signedDate: existing.signedDate ? existing.signedDate.slice(0, 10) : "",
        description: existing.description || "",
      });
      if (type === "purchase") setSupplierSearch(partnerName);
      else setCustomerSearch(partnerName);
    } else {
      setEditingContract(null);
      setContractForm({ contractNo: "", contractName: "", supplierId: "", supplierName: "", customerId: "", customerName: "", amount: "", signedDate: todayStr(), description: "" });
      if (type === "purchase") setSupplierSearch("");
      else setCustomerSearch("");
      apiFetch("/api/sequence/next?entity=contract").then(r => r.json()).then(j => {
        if (j.success) setContractForm(prev => ({ ...prev, contractNo: j.data.seq }));
      }).catch(() => {});
    }
    if (type === "purchase") setShowPurchForm(pkgId);
    else setShowSalesForm(pkgId);
  };

  if (loading) return <div className="text-muted">加载中...</div>;
  if (!project) return <div className="text-red-500">项目不存在</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">&larr; 返回项目列表</Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted mt-1">编码：{project.code} | 状态：{statusLabels[project.status] || project.status}</p>
        </div>
      </div>
      {project.description && <p className="text-sm text-muted mb-6 bg-white p-3 rounded-lg border border-border">{project.description}</p>}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">采购包</h2>
        <button onClick={() => { setEditingPkg(null); setPkgForm({ name: "", code: "", description: "", amount: "" }); setShowPkgForm(true); }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ 新建采购包</button>
      </div>

      {project.purchasePackages.length === 0 ? (
        <p className="text-sm text-muted text-center py-8 bg-white rounded-xl border border-border">暂无采购包，请先创建</p>
      ) : (
        <div className="space-y-6">
          {project.purchasePackages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-xl shadow-sm border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium">{pkg.name}</h3>
                  <p className="text-xs text-muted">{pkg.code} | {packageStatusLabels[pkg.status] || pkg.status} | 毛利：{(() => { const sp = pkg.salesContracts.reduce((s,c)=>s+Number(c.amount),0); const pp = pkg.purchaseContracts.reduce((s,c)=>s+Number(c.amount),0); const gp = sp - pp; return <span className={gp >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>¥{gp.toLocaleString()}</span>; })()}</p>
                </div>
                <div className="flex gap-1 items-center">
                  <button onClick={() => { setEditingPkg(pkg); setPkgForm({ name: pkg.name, code: pkg.code, description: pkg.description || "", amount: String(pkg.amount) }); setShowPkgForm(true); }}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button onClick={() => deletePackage(pkg.id)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Sales Contracts (left) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-green-700">销售合同（{(() => { const total = pkg.salesContracts.reduce((s, c) => s + Number(c.amount), 0); const unreceived = pkg.salesContracts.reduce((s, c) => s + Math.max(0, Number(c.amount) - Number(c.totalReceived)), 0); const uninvoiced = pkg.salesContracts.reduce((s, c) => s + Math.max(0, Number(c.amount) - Number(c.totalInvoiced)), 0); return <>合同总额 ¥{total.toLocaleString()}，<span className="text-red-500">未付 ¥{unreceived.toLocaleString()}</span>，<span className="text-red-500">未开票 ¥{uninvoiced.toLocaleString()}</span></>; })()}）</h4>
                      <button onClick={() => openContractForm(pkg.id, "sales")} className="text-xs text-green-600 hover:underline">+ 新建</button>
                    </div>
                    {pkg.salesContracts.length === 0 ? (
                      <p className="text-xs text-muted">暂无</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-left text-muted">
                              <th className="px-2 py-1.5 font-medium">合同名称</th>
                              <th className="px-2 py-1.5 font-medium">客户</th>
                              <th className="px-2 py-1.5 font-medium text-right">金额</th>
                              <th className="px-2 py-1.5 font-medium text-right">已收</th>
                              <th className="px-2 py-1.5 font-medium text-right">待收</th>
                              <th className="px-2 py-1.5 font-medium text-right">已开票</th>
                              <th className="px-2 py-1.5 font-medium text-right">待开票</th>
                              <th className="px-2 py-1.5 font-medium">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pkg.salesContracts.map((c) => (
                              <tr key={c.id} className="border-t border-border">
                                <td className="px-2 py-1.5"><Link href={`/sales-contracts/${c.id}`} className="text-blue-600 hover:underline">{c.contractName}</Link></td>
                                <td className="px-2 py-1.5 text-muted">{c.customer?.name || c.customerName || "—"}</td>
                                <td className="px-2 py-1.5 text-right">¥{Number(c.amount).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-green-600">¥{Number(c.totalReceived).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-red-600">¥{Math.max(0, Number(c.amount) - Number(c.totalReceived)).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-blue-600">¥{Number(c.totalInvoiced).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-orange-600">¥{Math.max(0, Number(c.amount) - Number(c.totalInvoiced)).toLocaleString()}</td>
                                <td className="px-2 py-1.5 align-middle whitespace-nowrap">
                                  <button onClick={() => openContractForm(pkg.id, "sales", c)} className="inline-flex items-center justify-center p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors align-middle" title="编辑">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                  </button>
                                  <button onClick={() => deleteContract(c.id, "sales")} className="inline-flex items-center justify-center p-1 text-red-600 hover:bg-red-50 rounded transition-colors align-middle" title="删除">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Purchase Contracts (right) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-amber-700">采购合同（{(() => { const total = pkg.purchaseContracts.reduce((s, c) => s + Number(c.amount), 0); const unpaid = pkg.purchaseContracts.reduce((s, c) => s + Math.max(0, Number(c.amount) - Number(c.totalPaid)), 0); const uninvoiced = pkg.purchaseContracts.reduce((s, c) => s + Math.max(0, Number(c.amount) - Number(c.totalInvoiced)), 0); return <>合同总额 ¥{total.toLocaleString()}，<span className="text-red-500">未付 ¥{unpaid.toLocaleString()}</span>，<span className="text-red-500">未开票 ¥{uninvoiced.toLocaleString()}</span></>; })()}）</h4>
                      <button onClick={() => openContractForm(pkg.id, "purchase")} className="text-xs text-amber-600 hover:underline">+ 新建</button>
                    </div>
                    {pkg.purchaseContracts.length === 0 ? (
                      <p className="text-xs text-muted">暂无</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-left text-muted">
                              <th className="px-2 py-1.5 font-medium">合同名称</th>
                              <th className="px-2 py-1.5 font-medium">供应商</th>
                              <th className="px-2 py-1.5 font-medium text-right">金额</th>
                              <th className="px-2 py-1.5 font-medium text-right">已付</th>
                              <th className="px-2 py-1.5 font-medium text-right">待付</th>
                              <th className="px-2 py-1.5 font-medium text-right">已开票</th>
                              <th className="px-2 py-1.5 font-medium text-right">待开票</th>
                              <th className="px-2 py-1.5 font-medium">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pkg.purchaseContracts.map((c) => (
                              <tr key={c.id} className="border-t border-border">
                                <td className="px-2 py-1.5"><Link href={`/purchase-contracts/${c.id}`} className="text-blue-600 hover:underline">{c.contractName}</Link></td>
                                <td className="px-2 py-1.5 text-muted">{c.supplier?.name || c.supplierName || "—"}</td>
                                <td className="px-2 py-1.5 text-right">¥{Number(c.amount).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-green-600">¥{Number(c.totalPaid).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-red-600">¥{Math.max(0, Number(c.amount) - Number(c.totalPaid)).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-blue-600">¥{Number(c.totalInvoiced).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right text-orange-600">¥{Math.max(0, Number(c.amount) - Number(c.totalInvoiced)).toLocaleString()}</td>
                                <td className="px-2 py-1.5 align-middle whitespace-nowrap">
                                  <button onClick={() => openContractForm(pkg.id, "purchase", c)} className="inline-flex items-center justify-center p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors align-middle" title="编辑">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                  </button>
                                  <button onClick={() => deleteContract(c.id, "purchase")} className="inline-flex items-center justify-center p-1 text-red-600 hover:bg-red-50 rounded transition-colors align-middle" title="删除">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showPkgForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowPkgForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editingPkg ? "编辑采购包" : "新建采购包"}</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1">采购包名称 *</label><input type="text" required value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">采购包编码 *</label><input type="text" required value={pkgForm.code} onChange={(e) => setPkgForm({ ...pkgForm, code: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">描述</label><textarea value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" rows={2} /></div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowPkgForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button>
                <button onClick={savePackage} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingPkg ? "保存" : "创建"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPurchForm && (
        <ContractModal
          title={editingContract ? "编辑采购合同" : "新建采购合同"}
          type="purchase"
          form={contractForm}
          setForm={setContractForm}
          partners={suppliers}
          partnerSearch={supplierSearch}
          setPartnerSearch={setSupplierSearch}
          onSave={() => saveContract(showPurchForm!, "purchase")}
          onClose={() => { setShowPurchForm(null); setEditingContract(null); }}
        />
      )}

      {showSalesForm && (
        <ContractModal
          title={editingContract ? "编辑销售合同" : "新建销售合同"}
          type="sales"
          form={contractForm}
          setForm={setContractForm}
          partners={customers}
          partnerSearch={customerSearch}
          setPartnerSearch={setCustomerSearch}
          onSave={() => saveContract(showSalesForm!, "sales")}
          onClose={() => { setShowSalesForm(null); setEditingContract(null); }}
        />
      )}
    </div>
  );
}

function ContractModal({
  title, type, form, setForm, partners, partnerSearch, setPartnerSearch, onSave, onClose,
}: {
  title: string; type: "purchase" | "sales";
  form: any; setForm: (f: any) => void;
  partners: any[]; partnerSearch: string; setPartnerSearch: (s: string) => void;
  onSave: () => void; onClose: () => void;
}) {
  const partnerLabel = type === "purchase" ? "供应商" : "客户";
  const partnerFieldId = type === "purchase" ? "supplierId" : "customerId";
  const partnerFieldName = type === "purchase" ? "supplierName" : "customerName";

  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const partnerDropdownRef = useRef<HTMLDivElement>(null);

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

  const inputValue = form[partnerFieldId] ? form[partnerFieldName] : partnerSearch;

  const filteredPartners = partners.filter((p) =>
    !partnerSearch || p.name.includes(partnerSearch)
  );

  const selectPartner = (partner: any) => {
    setForm({ ...form, [partnerFieldId]: partner.id, [partnerFieldName]: partner.name });
    setPartnerSearch("");
    setShowPartnerDropdown(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">合同编号 *</label>
            <input type="text" required value={form.contractNo} onChange={(e) => setForm({ ...form, contractNo: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">合同名称 *</label>
            <input type="text" required value={form.contractName} onChange={(e) => setForm({ ...form, contractName: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{partnerLabel} *</label>
            {form[partnerFieldName] && !form[partnerFieldId] ? (
              <input type="text" required value={form[partnerFieldName]} onChange={(e) => setForm({ ...form, [partnerFieldName]: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="输入名称" />
            ) : (
              <div className="relative" ref={partnerDropdownRef}>
                <input type="text" value={inputValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPartnerSearch(val);
                    if (form[partnerFieldId]) {
                      setForm({ ...form, [partnerFieldId]: "", [partnerFieldName]: "" });
                    }
                    setShowPartnerDropdown(true);
                  }}
                  onFocus={() => setShowPartnerDropdown(true)}
                  placeholder={`搜索${partnerLabel}...`}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                {form[partnerFieldId] && (
                  <button type="button" onClick={() => { setForm({ ...form, [partnerFieldId]: "", [partnerFieldName]: "" }); setPartnerSearch(""); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-500 hover:text-red-700">
                    清除
                  </button>
                )}
                {showPartnerDropdown && filteredPartners.length > 0 && (
                  <div className="absolute z-10 w-full border border-border rounded-lg max-h-48 overflow-y-auto bg-white mt-1 shadow-sm">
                    {filteredPartners.map((p) => (
                      <button key={p.id} type="button" onMouseDown={(e) => { e.preventDefault(); selectPartner(p); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-border last:border-b-0">
                        {p.name} {p.contactPerson ? `(${p.contactPerson})` : ""}
                      </button>
                    ))}
                  </div>
                )}
                {showPartnerDropdown && partnerSearch && filteredPartners.length === 0 && (
                  <p className="text-xs text-muted px-1 mt-1">未找到匹配的{partnerLabel}</p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">金额 *</label>
            <input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">签订日期</label>
            <input type="date" value={form.signedDate} onChange={(e) => setForm({ ...form, signedDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">备注</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" rows={2} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={onSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
