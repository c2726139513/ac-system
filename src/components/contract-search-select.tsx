"use client";

import { useState, useRef, useEffect } from "react";

interface Contract {
  id: string;
  contractNo: string;
  contractName: string;
  amount: number;
  supplierName?: string | null;
  customerName?: string | null;
  supplier?: { name: string } | null;
  customer?: { name: string } | null;
  purchasePackage?: {
    name: string;
    project?: { name: string } | null;
  } | null;
}

interface Props {
  contracts: Contract[];
  value: string;
  onChange: (contractId: string) => void;
  placeholder?: string;
}

function formatContract(c: Contract): string {
  const project = c.purchasePackage?.project?.name || "";
  const pkg = c.purchasePackage?.name || "";
  const amount = c.amount ? `¥${Number(c.amount).toLocaleString()}` : "";
  const counterparty = c.supplierName || c.supplier?.name || c.customerName || c.customer?.name || "";
  return [project, pkg, c.contractName, amount, counterparty].filter(Boolean).join(" / ");
}

export default function SearchableContractSelect({ contracts, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = contracts.find((c) => c.id === value);
  const filtered = contracts.filter((c) => formatContract(c).includes(search));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={open ? search : (selected ? formatContract(selected) : "")}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          setSearch("");
        }}
        placeholder={placeholder || "搜索并选择合同..."}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted text-center">无匹配合同</div>
          ) : (
            filtered.map((c) => {
              const isSelected = c.id === value;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`px-3 py-2.5 text-sm cursor-pointer border-b border-border last:border-b-0 hover:bg-blue-50 ${
                    isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                  }`}
                >
                  {formatContract(c)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
