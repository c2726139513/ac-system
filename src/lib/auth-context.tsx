"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  permissions: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasPermission: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  hasPermission: () => true,
});

const PUBLIC_PATHS = ["/login", "/setup"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const initRef = useRef(false);

  const hasPermission = useCallback(
    (module: string) => {
      if (!user) return false;
      let perms: string[];
      try {
        perms = JSON.parse(user.permissions);
      } catch {
        perms = [];
      }
      // Empty array = admin = all permissions
      if (perms.length === 0) return true;
      return perms.includes(module);
    },
    [user]
  );

  // Phase 1: Verify session on mount (runs once)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.success) {
            setUser(json.data);
            setLoading(false);
            return;
          }
        } catch {
          // network error — proceed with stale data
        }
        // Token invalid after DB reset — clear it
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
      setLoading(false);
    };

    init();
  }, []);

  // Phase 2: Route guard — redirect if not authenticated
  useEffect(() => {
    if (loading) return;
    if (PUBLIC_PATHS.includes(pathname)) return;

    const token = localStorage.getItem("token");
    if (!token) {
      // Check if system needs first-time setup
      fetch("/api/auth/setup")
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data.needsSetup) {
            router.replace("/setup");
          } else {
            router.push("/login");
          }
        })
        .catch(() => router.push("/login"));
    }
  }, [loading, pathname, router]);

  const login = (token: string, userData: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
