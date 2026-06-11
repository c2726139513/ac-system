"use client";

const STORAGE_KEY = "currentCompanyId";

export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const companyId =
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (companyId) {
    headers["x-company-id"] = companyId;
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}
