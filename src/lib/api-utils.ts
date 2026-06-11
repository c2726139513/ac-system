import { NextRequest, NextResponse } from "next/server";
import { verify } from "@/lib/jwt";

export function success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function getBody(request: Request): Promise<Record<string, unknown>> {
  return request.json();
}

export function requireCompanyId(request: NextRequest): string {
  const url = new URL(request.url);
  const fromHeader = request.headers.get("x-company-id");
  const fromQuery = url.searchParams.get("companyId");
  const companyId = fromHeader || fromQuery;
  if (!companyId) {
    throw new Error("缺少公司ID (companyId)");
  }
  return companyId;
}

const AUTH_WHITELIST = ["/api/auth/login", "/api/auth/setup", "/api/auth/me"];

/** Check JWT and verify user has the required module permission. Returns 403 response if denied, null if allowed. */
export async function requirePermission(request: NextRequest, module: string): Promise<NextResponse | null> {
  const url = new URL(request.url);
  // Skip auth-only endpoints
  if (AUTH_WHITELIST.some((p) => url.pathname.startsWith(p))) return null;

  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }
  const token = auth.slice(7);
  const payload = await verify(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: "登录已过期" }, { status: 401 });
  }
  const permsStr = (payload.permissions as string) || "";
  let perms: string[];
  try {
    perms = JSON.parse(permsStr);
  } catch {
    perms = [];
  }
  // Empty permissions array = admin = all access
  if (perms.length === 0) return null;
  if (!perms.includes(module)) {
    return NextResponse.json({ success: false, error: "没有此模块的操作权限" }, { status: 403 });
  }
  return null;
}
