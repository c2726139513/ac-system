"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth-context";

interface SidebarProps {
  user?: { name: string; role: string } | null;
  onLogout?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: string;
}

const allNavItems: NavItem[] = [
  { href: "/projects", label: "项目管理", icon: "📁", permission: "projects" },
  { href: "/contracts", label: "合同管理", icon: "📋", permission: "purchase-contracts" },
  { href: "/payments-receipts", label: "收付款", icon: "💳", permission: "payments" },
  { href: "/invoices", label: "发票管理", icon: "🧾", permission: "invoices" },
  { href: "/partners", label: "伙伴管理", icon: "🤝", permission: "partners" },
  { href: "/ofd/import", label: "OFD导入", icon: "📤", permission: "invoices" },
  { href: "/users", label: "用户管理", icon: "👥", permission: "users" },
  { href: "/companies", label: "公司管理", icon: "🏢", permission: "companies" },
];

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { companies, currentCompany, setCurrentCompany } = useCompany();
  const { hasPermission } = useAuth();
  const navItems = allNavItems.filter((item) => !item.permission || hasPermission(item.permission));
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCompanyDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCompanyDropdown]);

  return (
    <aside className="w-56 bg-sidebar text-white flex flex-col shrink-0">
      <div className="p-4 border-b border-white/10">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
            className="w-full text-left text-lg font-bold tracking-wide hover:text-white/80 transition-colors flex items-center justify-between gap-1"
          >
            <span className="truncate">{currentCompany?.name || "合同发票管理"}</span>
            <span className="text-xs shrink-0">{showCompanyDropdown ? "▲" : "▼"}</span>
          </button>
          <p className="text-xs text-white/50 mt-1">Contract & Invoice System</p>
          {showCompanyDropdown && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white text-gray-800 rounded-lg shadow-lg border border-border overflow-hidden">
              {companies.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted">暂无公司</div>
              )}
              {companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCurrentCompany(c); setShowCompanyDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-border last:border-b-0 flex items-center justify-between ${c.id === currentCompany?.id ? "bg-blue-50 text-blue-700 font-medium" : ""}`}
                >
                  <span>{c.name}</span>
                  {c.id === currentCompany?.id && <span className="text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-active/20 text-sidebar-active border-r-2 border-sidebar-active"
                  : "text-white/70 hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {user && (
        <div className="p-4 border-t border-white/10">
          <div className="text-sm text-white/80">{user.name}</div>
          <div className="text-xs text-white/40 mt-0.5">{user.role}</div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-2 text-xs text-white/40 hover:text-white/80 transition-colors"
            >
              退出登录
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
