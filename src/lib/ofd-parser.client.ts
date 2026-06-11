import { unzipSync } from "fflate";

interface OfdInvoiceInfo {
  invoiceNo: string;
  invoiceCode: string;
  invoiceDate: string;
  amount: string;
  taxAmount: string;
  totalAmount: string;
  sellerName: string;
  sellerTaxId: string;
  buyerName: string;
  buyerTaxId: string;
  invoiceType: string;
}

interface OfdPaymentInfo {
  amount: string;
  date: string;
  description: string;
  payerName: string;
  payeeName: string;
  notes: string;
  receiptNo: string;
  receiptType: string;
}

export type OfdParsedResult =
  | { type: "invoice"; data: OfdInvoiceInfo }
  | { type: "payment"; data: OfdPaymentInfo }
  | { type: "unknown"; data: Record<string, string> };

function extractField(xml: string, patterns: RegExp[]): string | undefined {
  for (const regex of patterns) {
    const match = xml.match(regex);
    if (match && match[1]) return match[1].trim();
  }
  return undefined;
}

function extractXbrlFields(xml: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const patterns: [string, RegExp][] = [
    ["transactionAmount", /<bker:TransactionAmountInFigures[^>]*>\s*([^<]+)/],
    ["dateOfBookkeeping", /<bker:DateOfBookkeeping[^>]*>\s*([^<]+)/],
    ["issueDate", /<bker:IssueDate[^>]*>\s*([^<]+)/],
    ["usage", /<bker:Usage[^>]*>\s*([^<]+)/],
    ["payerName", /<bker:AccountNameOfPayer[^>]*>\s*([^<]+)/],
    ["payeeName", /<bker:AccountNameOfPayee[^>]*>\s*([^<]+)/],
    ["notes", /<bker:Notes[^>]*>\s*([^<]+)/],
    ["receiptNo", /<bker:NumberOfBankElectronicReceipt[^>]*>\s*([^<]+)/],
    ["receiptType", /<bker:TypeOfBankElectronicReceipt[^>]*>\s*([^<]+)/],
    ["payerAccount", /<bker:AccountNumberOfPayer[^>]*>\s*([^<]+)/],
    ["payeeAccount", /<bker:AccountNumberOfPayee[^>]*>\s*([^<]+)/],
    ["transactionCode", /<bker:TransactionCode[^>]*>\s*([^<]+)/],
    ["businessSerial", /<bker:BusinessSerialNumber[^>]*>\s*([^<]+)/],
    ["identificationCode", /<bker:IdentifyingCode[^>]*>\s*([^<]+)/],
  ];
  for (const [key, regex] of patterns) {
    const match = xml.match(regex);
    if (match && match[1].trim()) {
      fields[key] = match[1].trim();
    }
  }
  return fields;
}

function parseBankReceipt(entryMap: Map<string, string>): OfdParsedResult | null {
  const xbrlEntries: string[] = [];
  for (const [name, content] of entryMap) {
    if (name.includes("Attach") && name.endsWith(".xml") && content.includes("xbrl")) {
      xbrlEntries.push(content);
    }
  }
  if (xbrlEntries.length === 0) return null;

  for (const xml of xbrlEntries) {
    try {
      const fields = extractXbrlFields(xml);
      if (fields.transactionAmount) {
        return {
          type: "payment",
          data: {
            amount: fields.transactionAmount,
            date: fields.dateOfBookkeeping || fields.issueDate || "",
            description: fields.usage || "",
            payerName: fields.payerName || "",
            payeeName: fields.payeeName || "",
            notes: fields.notes || "",
            receiptNo: fields.receiptNo || "",
            receiptType: fields.receiptType || "",
          },
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parseInvoiceCustomData(entryMap: Map<string, string>): OfdParsedResult | null {
  const ofdXml = entryMap.get("OFD.xml");
  if (!ofdXml) return null;

  const customData: Record<string, string> = {};
  const customDataRegex = /<ofd:CustomData\s+Name="([^"]*)"[^>]*>([^<]*)<\/ofd:CustomData>/g;
  let match;
  while ((match = customDataRegex.exec(ofdXml)) !== null) {
    customData[match[1]] = match[2].trim();
  }

  const invoiceNo = customData["发票号码"] || "";
  if (!invoiceNo) return null;

  let invoiceDate = customData["开票日期"] || "";
  invoiceDate = invoiceDate.replace(/年/g, "-").replace(/月/g, "-").replace(/日/g, "");

  const je = parseFloat(customData["合计金额"] || "0");
  const se = parseFloat(customData["合计税额"] || "0");

  return {
    type: "invoice",
    data: {
      invoiceNo,
      invoiceCode: customData["发票代码"] || "",
      invoiceDate,
      amount: customData["合计金额"] || "0",
      taxAmount: customData["合计税额"] || "0",
      totalAmount: (je + se).toFixed(2),
      sellerName: customData["销售方名称"] || "",
      sellerTaxId: customData["销售方纳税人识别号"] || "",
      buyerName: customData["购买方名称"] || "",
      buyerTaxId: customData["购买方纳税人识别号"] || "",
      invoiceType: customData["发票类型"] || "SPECIAL",
    },
  };
}

function parseInvoiceXml(xml: string): OfdInvoiceInfo | null {
  const invoiceNo =
    extractField(xml, [
      /发票号码[：:>\]]\s*([^<\s]+)/i,
      /FPHM[：:>\]]\s*([^<\s]+)/i,
      /"发票号码"[^>]*>([^<]+)/,
      /发票号码[^:：\n]*?[：:]\s*(\d+)/,
      />(\d{20,24})</,
    ]) || "";

  if (!invoiceNo) return null;

  const invoiceCode = extractField(xml, [
    /发票代码[：:>\]]\s*([^<\s]+)/i,
    /FPDM[：:>\]]\s*([^<\s]+)/i,
    /"发票代码"[^>]*>([^<]+)/,
  ]) || "";

  let invoiceDate = extractField(xml, [
    /开票日期[：:>\]]\s*([^<\s<]+)/i,
    /KPRQ[：:>\]]\s*([^<\s]+)/i,
    /"开票日期"[^>]*>([^<]+)/,
    /开票日期[^:：\n]*?[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/,
  ]) || "";
  invoiceDate = invoiceDate.replace(/年/g, "-").replace(/月/g, "-").replace(/日/g, "");

  const je = extractField(xml, [/合计金额[：:>\]]\s*([\d,]+\.?\d*)/i, /"合计金额"[^>]*>([^<]+)/, /JE[：:>\]]\s*([^<\s]+)/i]) || "0";
  const se = extractField(xml, [/合计税额[：:>\]]\s*([\d,]+\.?\d*)/i, /"合计税额"[^>]*>([^<]+)/, /SE[：:>\]]\s*([^<\s]+)/i]) || "0";
  const totalAmount = extractField(xml, [
    /价税合计[：:>\]]\s*([\d,]+\.?\d*)/i,
    /JSHJ[：:>\]]\s*([^<\s]+)/i,
    /"价税合计"[^>]*>([^<]+)/,
  ]) || String((parseFloat(je) + parseFloat(se)).toFixed(2));

  const sellerName = extractField(xml, [/销售方名称[：:>\]]\s*([^<\n]+)/i, /XSFMC[：:>\]]\s*([^<\s]+)/i, /"销售方名称"[^>]*>([^<]+)/]) || "";
  const buyerName = extractField(xml, [/购买方名称[：:>\]]\s*([^<\n]+)/i, /GMFMC[：:>\]]\s*([^<\s]+)/i, /"购买方名称"[^>]*>([^<]+)/]) || "";
  const sellerTaxId = extractField(xml, [/销售方纳税人识别号[：:>\]]\s*([^<\s]+)/i, /"销售方纳税人识别号"[^>]*>([^<]+)/]) || "";
  const buyerTaxId = extractField(xml, [/购买方纳税人识别号[：:>\]]\s*([^<\s]+)/i, /"购买方纳税人识别号"[^>]*>([^<]+)/]) || "";

  return {
    invoiceNo,
    invoiceCode,
    invoiceDate,
    amount: je,
    taxAmount: se,
    totalAmount,
    sellerName,
    sellerTaxId,
    buyerName,
    buyerTaxId,
    invoiceType: "SPECIAL",
  };
}

function parsePaymentXml(xml: string): OfdPaymentInfo | null {
  const amount =
    extractField(xml, [
      /TransactionAmountInFigures[^>]*>([^<]+)/,
      /付款金额[：:]\s*([\d,]+\.?\d*)/i,
      /金额[：:]\s*([\d,]+\.?\d*)/i,
    ]) || "";

  if (!amount) return null;

  const date = extractField(xml, [
    /DateOfBookkeeping[^>]*>([^<]+)/,
    /IssueDate[^>]*>([^<]+)/,
    /付款日期[：:]\s*([^\s<]+)/i,
    /日期[：:]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
  ]) || "";

  const description = extractField(xml, [/Usage[^>]*>([^<]+)/, /摘要[：:]\s*([^<\n]+)/i, /用途[：:]\s*([^<\n]+)/i]) || "";
  const payerName = extractField(xml, [/AccountNameOfPayer[^>]*>([^<]+)/, /付款人[：:]\s*([^<\n]+)/i]) || "";
  const payeeName = extractField(xml, [/AccountNameOfPayee[^>]*>([^<]+)/, /收款人[：:]\s*([^<\n]+)/i]) || "";
  const notes = extractField(xml, [/Notes[^>]*>([^<]+)/, /备注[：:]\s*([^<\n]+)/i]) || "";
  const receiptNo = extractField(xml, [/NumberOfBankElectronicReceipt[^>]*>([^<]+)/]) || "";
  const receiptType = extractField(xml, [/TypeOfBankElectronicReceipt[^>]*>([^<]+)/]) || "";

  return { amount, date, description, payerName, payeeName, notes, receiptNo, receiptType };
}

function extractKeyValuePairs(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const kvPattern = /([\u4e00-\u9fa5\w]+)\s*[:：]\s*([^\n\r,;]{1,200})/g;
  let match;
  while ((match = kvPattern.exec(text)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (value) result[key] = value;
  }
  return result;
}

/**
 * Enhance invoice data by extracting structured fields from CustomTag.xml
 * and the corresponding TextObject values from Content.xml.
 * Many Chinese OFD invoices store seller/buyer names in CustomTag.xml
 * rather than in the OFD.xml CustomData.
 */
function enhanceWithCustomTag(
  entryMap: Map<string, string>,
  base: OfdInvoiceInfo
): OfdInvoiceInfo | null {
  if (base.sellerName && base.buyerName) return null;

  const customTagXml = entryMap.get("Doc_0/Tags/CustomTag.xml");
  const pageContentXml = entryMap.get("Doc_0/Pages/Page_0/Content.xml");
  if (!customTagXml || !pageContentXml) return null;

  const refs: Record<string, string> = {};
  const fieldPatterns = ["BuyerName", "BuyerTaxID", "SellerName", "SellerTaxID"];
  for (const field of fieldPatterns) {
    const re = new RegExp(
      `<ofd:${field}>\\s*<ofd:ObjectRef[^>]*>(\\d+)<\\/ofd:ObjectRef>\\s*<\\/ofd:${field}>`
    );
    const m = customTagXml.match(re);
    if (m) refs[field] = m[1];
  }

  if (Object.keys(refs).length === 0) return null;

  function getTextById(xml: string, id: string): string {
    const re = new RegExp(
      `<ofd:TextObject[^>]*\\bID="${id}"[^>]*>.*?<ofd:TextCode[^>]*>([^<]+)<\\/ofd:TextCode>`,
      "s"
    );
    const m = xml.match(re);
    return m ? m[1].trim() : "";
  }

  const xml = pageContentXml;

  const enhanced = { ...base };
  if (refs["SellerName"]) enhanced.sellerName = getTextById(xml, refs["SellerName"]) || enhanced.sellerName;
  if (refs["SellerTaxID"]) enhanced.sellerTaxId = getTextById(xml, refs["SellerTaxID"]) || enhanced.sellerTaxId;
  if (refs["BuyerName"]) enhanced.buyerName = getTextById(xml, refs["BuyerName"]) || enhanced.buyerName;
  if (refs["BuyerTaxID"]) enhanced.buyerTaxId = getTextById(xml, refs["BuyerTaxID"]) || enhanced.buyerTaxId;

  return enhanced;
}

/**
 * Parse an OFD file from an ArrayBuffer (browser File API).
 * No file upload needed — everything runs client-side.
 */
export function parseOfdFile(buffer: ArrayBuffer): OfdParsedResult {
  const uint8 = new Uint8Array(buffer);

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(uint8);
  } catch {
    return { type: "unknown", data: { error: "无法打开OFD文件（非ZIP格式）" } };
  }

  // Decode XML entries to strings
  const entryMap = new Map<string, string>();
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith(".xml")) {
      entryMap.set(name, new TextDecoder("utf-8").decode(data));
    }
  }

  // Strategy 1: XBRL bank receipt
  const paymentResult = parseBankReceipt(entryMap);
  if (paymentResult) return paymentResult;

  // Strategy 2: CustomData invoice (OFD.xml with 发票号码)
  const invoiceResult = parseInvoiceCustomData(entryMap);
  if (invoiceResult && invoiceResult.type === "invoice") {
    const enhanced = enhanceWithCustomTag(entryMap, invoiceResult.data);
    if (enhanced) return { type: "invoice", data: enhanced };
    return invoiceResult;
  }

  // Strategy 3: Regex-based invoice (concatenated XML)
  const allXml = Array.from(entryMap.values()).join("\n");
  const regexInvoice = parseInvoiceXml(allXml);
  if (regexInvoice) return { type: "invoice", data: regexInvoice };

  // Strategy 4: Regex-based payment
  const regexPayment = parsePaymentXml(allXml);
  if (regexPayment) return { type: "payment", data: regexPayment };

  // Strategy 5: Key-value pair fallback
  const plainText = allXml
    .replace(/<[^>]*>/g, " ")
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pairs = extractKeyValuePairs(plainText);
  if (Object.keys(pairs).length > 0) return { type: "unknown", data: pairs };

  return { type: "unknown", data: { rawContent: plainText.substring(0, 2000) } };
}
