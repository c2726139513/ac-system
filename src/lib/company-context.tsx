"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiFetch } from "./api-client";

interface Company {
  id: string; name: string; taxId: string | null;
  address: string | null; phone: string | null;
  bankName: string | null; bankAccount: string | null;
  isDefault: boolean; active: boolean;
}

interface CompanyContextType {
  companies: Company[];
  currentCompany: Company | null;
  setCurrentCompany: (c: Company) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [], currentCompany: null, setCurrentCompany: () => {},
  loading: true, refresh: async () => {},
});

const STORAGE_KEY = "currentCompanyId";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/companies");
      const json = await res.json();
      if (json.success) {
        setCompanies(json.data);
        const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const found = storedId ? json.data.find((c: Company) => c.id === storedId) : null;
        const defaultComp = json.data.find((c: Company) => c.isDefault);
        setCurrentCompanyState(found || defaultComp || json.data[0] || null);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setCurrentCompany = (c: Company) => {
    setCurrentCompanyState(c);
    localStorage.setItem(STORAGE_KEY, c.id);
  };

  return (
    <CompanyContext.Provider value={{ companies, currentCompany, setCurrentCompany, loading, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
