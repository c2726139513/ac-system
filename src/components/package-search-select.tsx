"use client";

import { useState, useRef, useEffect } from "react";

interface PurchasePackage {
  id: string;
  name: string;
  code: string;
  project?: { name: string } | null;
}

interface Props {
  packages: PurchasePackage[];
  value: string;
  onChange: (pkgId: string) => void;
  placeholder?: string;
}

function formatPackage(p: PurchasePackage): string {
  const project = p.project?.name || "";
  return [project, `${p.name} (${p.code})`].filter(Boolean).join(" / ");
}

export default function SearchablePackageSelect({ packages: pkgs, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = pkgs.find((p) => p.id === value);
  const filtered = pkgs.filter((p) => formatPackage(p).includes(search));

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
        value={open ? search : (selected ? formatPackage(selected) : "")}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          setSearch("");
        }}
        placeholder={placeholder || "搜索并选择采购包..."}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted text-center">无匹配采购包</div>
          ) : (
            filtered.map((p) => {
              const isSelected = p.id === value;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`px-3 py-2.5 text-sm cursor-pointer border-b border-border last:border-b-0 hover:bg-blue-50 ${
                    isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                  }`}
                >
                  {formatPackage(p)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
