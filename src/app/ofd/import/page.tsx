"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { parseOfdFile, type OfdParsedResult } from "@/lib/ofd-parser.client";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import SearchableContractSelect from "@/components/contract-search-select";

interface DirectionResult {
  contractType: "purchase" | "sales";
  counterpartyName: string | null;
}

interface ImportEntry {
  id: string;
  file: File;
  parsed: OfdParsedResult | null;
  error: string | null;
  contractType: "purchase" | "sales";
  counterpartyName: string;
  contractId: string;
  saved: boolean;
  saving: boolean;
}

let idCounter = 0;
function nextId() {
  return `entry-${++idCounter}`;
}

/**
 * Analyze OFD parsed data to determine:
 * 1. Contract direction (purchase vs sales) — based on whether our company name
 *    appears as seller/buyer (invoice) or payer/payee (payment)
 * 2. Counterparty name — the OTHER company involved in the transaction
 *
 * Rules:
 * - Invoice: seller=我方 → sales (我方开票给客户), buyer=我方 → purchase (供应商开票给我方)
 * - Payment: payer=我方 → purchase (我方付款给供应商), payee=我方 → sales (客户付款给我方)
 */
function analyzeDirection(
  parsed: OfdParsedResult,
  companyName: string
): DirectionResult {
  const normalized = companyName.trim().toLowerCase();

  if (parsed.type === "invoice") {
    const seller = (parsed.data.sellerName || "").trim();
    const buyer = (parsed.data.buyerName || "").trim();
    const isSellerUs = seller.toLowerCase().includes(normalized);
    const isBuyerUs = buyer.toLowerCase().includes(normalized);

    if (isSellerUs && !isBuyerUs) {
      return { contractType: "sales", counterpartyName: buyer || null };
    }
    if (isBuyerUs && !isSellerUs) {
      return { contractType: "purchase", counterpartyName: seller || null };
    }
    // Ambiguous: both sides match or neither matches — default purchase
    return {
      contractType: "purchase",
      counterpartyName: isSellerUs ? buyer : isBuyerUs ? seller : null,
    };
  }

  if (parsed.type === "payment") {
    const payer = (parsed.data.payerName || "").trim();
    const payee = (parsed.data.payeeName || "").trim();
    const isPayerUs = payer.toLowerCase().includes(normalized);
    const isPayeeUs = payee.toLowerCase().includes(normalized);

    if (isPayerUs && !isPayeeUs) {
      return { contractType: "purchase", counterpartyName: payee || null };
    }
    if (isPayeeUs && !isPayerUs) {
      return { contractType: "sales", counterpartyName: payer || null };
    }
    return {
      contractType: "purchase",
      counterpartyName: isPayerUs ? payee : isPayeeUs ? payer : null,
    };
  }

  return { contractType: "purchase", counterpartyName: null };
}

/**
 * Find matching contracts of the given type where the supplier/customer name
 * matches the counterparty. Returns the contract ID if exactly one match,
 * otherwise empty string (user picks from filtered list).
 */
function autoMatchContract(
  contracts: any[],
  counterpartyName: string
): string {
  const matchField = (c: any) =>
    (c.supplierName || c.supplier?.name || c.customerName || c.customer?.name || "").toLowerCase();
  const target = counterpartyName.toLowerCase();
  const matches = contracts.filter((c) => matchField(c).includes(target));
  return matches.length === 1 ? matches[0].id : "";
}

export default function OfdImportPage() {
  const { currentCompany } = useCompany();
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");
  const [purchaseContracts, setPurchaseContracts] = useState<any[]>([]);
  const [salesContracts, setSalesContracts] = useState<any[]>([]);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Always-up-to-date refs for async handler access
  const purchaseContractsRef = useRef(purchaseContracts);
  const salesContractsRef = useRef(salesContracts);
  purchaseContractsRef.current = purchaseContracts;
  salesContractsRef.current = salesContracts;

  const loadContracts = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        apiFetch("/api/purchase-contracts"),
        apiFetch("/api/sales-contracts"),
      ]);
      const pJson = await pRes.json();
      const sJson = await sRes.json();
      if (pJson.success) setPurchaseContracts(pJson.data);
      if (sJson.success) setSalesContracts(sJson.data);
      setContractsLoaded(true);
    } catch {
      // Contracts will be reloaded on save if needed
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalid = files.find((f) => !f.name.toLowerCase().endsWith(".ofd"));
    if (invalid) {
      setMessage(`"${invalid.name}" 不是OFD格式文件`);
      return;
    }

    setEntries((prev) => [
      ...prev,
        ...files.map((file) => ({
        id: nextId(),
        file,
        parsed: null,
        error: null,
        contractType: "purchase" as const,
        counterpartyName: "",
        contractId: "",
        saved: false,
        saving: false,
      })),
    ]);
    setMessage("");
      if (fileRef.current) fileRef.current.value = "";
  };

  const handleParseAll = async () => {
    const toParse = entries.filter((e) => !e.parsed && !e.error && !e.saved);
    if (toParse.length === 0) {
      setMessage("没有待解析的文件");
      return;
    }

    if (!currentCompany?.name) {
      setMessage("请先选择当前公司");
      return;
    }

    if (!contractsLoaded) {
      setMessage("合同列表尚未加载完成，请稍候");
      return;
    }

    setParsing(true);
    setMessage("");

    const companyName = currentCompany.name;
    // Use refs for latest contracts (avoids stale closure in async flow)
    const pContracts = purchaseContractsRef.current;
    const sContracts = salesContractsRef.current;

    const results = await Promise.allSettled(
      toParse.map(async (entry) => {
        const buffer = await entry.file.arrayBuffer();
        return { id: entry.id, result: parseOfdFile(buffer) };
      })
    );

    setEntries((prev) => {
      const next = [...prev];
      const failedIds = new Set(
        results
          .map((r, i) => (r.status === "rejected" ? toParse[i]?.id : null))
          .filter(Boolean)
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          const { id, result } = r.value;
          const idx = next.findIndex((e) => e.id === id);
          if (idx === -1) continue;

          if (result.type === "unknown") {
            next[idx] = { ...next[idx], parsed: result, error: "未能识别文件类型" };
            continue;
          }

          const { contractType, counterpartyName } = analyzeDirection(result, companyName);

          if (!counterpartyName) {
            next[idx] = {
              ...next[idx],
              parsed: result,
              error: "当前公司不在此单据的双方中，无法自动匹配合同方向。请切换公司或手动处理。",
              counterpartyName: "",
              contractId: "",
            };
            continue;
          }

          const typeContracts = contractType === "purchase" ? pContracts : sContracts;
          const autoId = autoMatchContract(typeContracts, counterpartyName);

          next[idx] = {
            ...next[idx],
            parsed: result,
            error: null,
            contractType,
            counterpartyName,
            contractId: autoId,
          };
        }
      }
      for (const id of failedIds) {
        const idx = next.findIndex((e) => e.id === id);
        if (idx !== -1) {
          next[idx] = { ...next[idx], error: "解析异常" };
        }
      }
      return next;
    });

    setParsing(false);
  };

  const updateEntry = (id: string, patch: Partial<ImportEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  };

  const handleSave = async (entry: ImportEntry) => {
    if (!entry.parsed || entry.parsed.type === "unknown" || !entry.contractId) return;

    updateEntry(entry.id, { saving: true });
    setMessage("");

    try {
      const { parsed, contractType, contractId } = entry;
      let res: Response;

      if (parsed.type === "invoice") {
        const endpoint = contractType === "purchase" ? "purchase-invoices" : "sales-invoices";
        const idField = contractType === "purchase" ? "purchaseContractId" : "salesContractId";
        res = await apiFetch(`/api/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [idField]: contractId,
            invoiceNo: parsed.data.invoiceNo,
            invoiceCode: parsed.data.invoiceCode,
            invoiceDate: parsed.data.invoiceDate || new Date().toISOString().split("T")[0],
            amount: parseFloat(parsed.data.amount) || 0,
            taxAmount: parseFloat(parsed.data.taxAmount) || 0,
            totalAmount: parseFloat(parsed.data.totalAmount) || 0,
            sellerName: parsed.data.sellerName,
            buyerName: parsed.data.buyerName,
            invoiceType: parsed.data.invoiceType,
          }),
        });
      } else if (parsed.type === "payment" && contractType === "purchase") {
        res = await apiFetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchaseContractId: contractId,
            amount: parseFloat(parsed.data.amount) || 0,
            paymentDate: parsed.data.date || new Date().toISOString().split("T")[0],
            description:
              parsed.data.description ||
              parsed.data.notes ||
              `${parsed.data.payerName}->${parsed.data.payeeName}`,
          }),
        });
      } else if (parsed.type === "payment" && contractType === "sales") {
        res = await apiFetch("/api/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salesContractId: contractId,
            amount: parseFloat(parsed.data.amount) || 0,
            receiptDate: parsed.data.date || new Date().toISOString().split("T")[0],
            description:
              parsed.data.description ||
              parsed.data.notes ||
              `${parsed.data.payerName}->${parsed.data.payeeName}`,
          }),
        });
      } else {
        throw new Error("不支持的数据类型");
      }

      const json = await res.json();
      if (json.success) {
        updateEntry(entry.id, { saved: true, saving: false });
      } else {
        setMessage(`${entry.file.name}: ${json.error || "保存失败"}`);
        updateEntry(entry.id, { saving: false });
      }
    } catch (err: any) {
      setMessage(`${entry.file.name}: ${err.message || "保存失败"}`);
      updateEntry(entry.id, { saving: false });
    }
  };

  const handleSaveAll = async () => {
    const unsaved = entries.filter(
      (e) => e.parsed && e.parsed.type !== "unknown" && e.contractId && !e.saved
    );
    if (unsaved.length === 0) {
      setMessage("没有待保存的条目");
      return;
    }
    for (const entry of unsaved) {
      await handleSave(entry);
    }
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const clearAll = () => {
    setEntries([]);
    setMessage("");
  };

  const contractsFor = (type: "purchase" | "sales") =>
    type === "purchase" ? purchaseContracts : salesContracts;

  const parsedCount = entries.filter((e) => e.parsed).length;
  const savedCount = entries.filter((e) => e.saved).length;
  const pendingCount = entries.length - parsedCount;
  const readyToSave = entries.filter(
    (e) => e.parsed && e.parsed.type !== "unknown" && e.contractId && !e.saved
  ).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">OFD文件批量导入</h1>

      {entries.length > 0 && (
        <div className="flex gap-4 mb-4 text-sm text-muted">
          <span>共 {entries.length} 个文件</span>
          <span>已解析 {parsedCount}</span>
          <span>已保存 {savedCount}</span>
          {pendingCount > 0 && <span>待解析 {pendingCount}</span>}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-border p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">选择OFD文件（可多选）</label>
          <input
            ref={fileRef}
            type="file"
            accept=".ofd"
            multiple
            onChange={handleFilesChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-muted mt-1">
            文件仅在前端解析，不会上传到服务器
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          {entries.length > 0 && (
            <>
              <button
                onClick={handleParseAll}
                disabled={parsing || pendingCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {parsing ? "解析中..." : "解析全部"}
              </button>
              {readyToSave > 0 && (
                <button
                  onClick={handleSaveAll}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  全部保存 ({readyToSave})
                </button>
              )}
              <button
                onClick={clearAll}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-gray-50"
              >
                清空列表
              </button>
            </>
          )}
        </div>

        {!contractsLoaded && entries.length > 0 && (
          <p className="text-sm text-amber-600 mb-4">正在加载合同列表...</p>
        )}

        {entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`border rounded-lg p-4 ${
                  entry.saved ? "bg-green-50 border-green-200" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm truncate">
                        {entry.file.name}
                      </span>
                      {entry.parsed && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            entry.parsed.type === "invoice"
                              ? "bg-purple-100 text-purple-700"
                              : entry.parsed.type === "payment"
                              ? "bg-teal-100 text-teal-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {entry.parsed.type === "invoice"
                            ? "发票"
                            : entry.parsed.type === "payment"
                            ? "银行回单"
                            : "未知"}
                        </span>
                      )}
                      {entry.saved && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ 已保存
                        </span>
                      )}
                    </div>

                    {entry.parsed && entry.parsed.type !== "unknown" && (
                      <div className="text-xs text-muted space-y-0.5 mb-3">
                        {entry.parsed.type === "invoice" ? (
                          <>
                            <span>
                              发票号码：{entry.parsed.data.invoiceNo || "—"}
                            </span>
                            <span className="mx-2">|</span>
                            <span>
                              价税合计：¥
                              {entry.parsed.data.totalAmount}
                            </span>
                            <span className="mx-2">|</span>
                            <span>
                              开票日期：{entry.parsed.data.invoiceDate || "—"}
                            </span>
                            <span className="mx-2">|</span>
                            <span>
                              {entry.parsed.data.sellerName || "—"}→
                              {entry.parsed.data.buyerName || "—"}
                            </span>
                          </>
                        ) : entry.parsed.type === "payment" ? (
                          <>
                            <span>
                              金额：¥{entry.parsed.data.amount}
                            </span>
                            <span className="mx-2">|</span>
                            <span>
                              日期：{entry.parsed.data.date || "—"}
                            </span>
                            <span className="mx-2">|</span>
                            <span>
                              {entry.parsed.data.payerName}→
                              {entry.parsed.data.payeeName}
                            </span>
                          </>
                        ) : null}
                        {entry.counterpartyName && (
                          <span className="ml-2 text-blue-600 font-medium">
                            对方：{entry.counterpartyName}
                          </span>
                        )}
                      </div>
                    )}

                    {entry.error && (
                      <p className="text-xs text-red-500 mb-2">{entry.error}</p>
                    )}

                    {entry.parsed && entry.parsed.type !== "unknown" && !entry.saved && entry.counterpartyName && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex border border-border rounded-lg overflow-hidden">
                          <span className="px-3 py-1 text-xs font-medium bg-blue-600 text-white shrink-0">
                            {entry.contractType === "purchase" ? "采购" : "销售"}
                          </span>
                        </div>
                        <div className="flex-1" style={{ minWidth: 250 }}>
                          {(() => {
                            const list = contractsFor(entry.contractType);
                            const getCounterpartyField = (c: any) =>
                              entry.contractType === "purchase"
                                ? (c.supplierName || c.supplier?.name || "")
                                : (c.customerName || c.customer?.name || "");
                            const filtered = entry.counterpartyName
                              ? list.filter((c: any) =>
                                  getCounterpartyField(c).toLowerCase().includes(entry.counterpartyName.toLowerCase())
                                )
                              : list;
                            return (
                              <SearchableContractSelect
                                contracts={filtered}
                                value={entry.contractId}
                                onChange={(id) => updateEntry(entry.id, { contractId: id })}
                                placeholder="搜索合同..."
                              />
                            );
                          })()}
                        </div>
                        <button
                          onClick={() => handleSave(entry)}
                          disabled={!entry.contractId || entry.saving}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium disabled:opacity-50"
                        >
                          {entry.saving ? "保存中..." : "保存"}
                        </button>
                      </div>
                    )}

                    {!entry.parsed && !entry.error && (
                      <p className="text-xs text-gray-400">待解析</p>
                    )}

                    {entry.parsed?.type === "unknown" && (
                      <p className="text-xs text-amber-600">
                        未能识别文件内容，可手动录入
                      </p>
                    )}
                  </div>

                  {!entry.saved && (
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="text-gray-400 hover:text-red-500 text-sm shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {message && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              message.includes("成功")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
