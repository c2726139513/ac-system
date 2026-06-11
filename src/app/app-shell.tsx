"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";

const PATH_MODULES: Record<string, string> = {
  "/projects": "projects",
  "/contracts": "purchase-contracts",
  "/payments-receipts": "payments",
  "/invoices": "invoices",
  "/partners": "partners",
  "/ofd": "invoices",
  "/users": "users",
  "/companies": "companies",
};

function getRequiredModule(pathname: string): string | null {
  for (const [prefix, module] of Object.entries(PATH_MODULES)) {
    if (pathname.startsWith(prefix)) return module;
  }
  return null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading, hasPermission, logout } = useAuth();
  const { currentCompany, loading: companyLoading } = useCompany();
  const isPublicPage = pathname === "/login" || pathname === "/setup";

  useEffect(() => {
    if (currentCompany) {
      document.title = `${currentCompany.name} - 合同发票管理系统`;
    } else {
      document.title = "合同发票管理系统";
    }
  }, [currentCompany]);

  if (authLoading || companyLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted">
        加载中...
      </div>
    );
  }

  if (isPublicPage) {
    return <div className="h-full">{children}</div>;
  }

  if (!user) {
    return <div className="h-full">{children}</div>;
  }

  // Permission guard
  const requiredModule = getRequiredModule(pathname);
  if (requiredModule && !hasPermission(requiredModule)) {
    return (
      <div className="h-full flex">
        <Sidebar user={user} onLogout={logout} />
        <main key={currentCompany?.id || "no-company"} className="flex-1 overflow-auto p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold mb-2">无权限访问</h2>
            <p className="text-muted">您没有此模块的操作权限，请联系管理员</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <Sidebar user={user} onLogout={logout} />
      <main key={currentCompany?.id || "no-company"} className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
