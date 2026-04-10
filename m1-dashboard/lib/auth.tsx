"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import Keycloak from "keycloak-js";

const keycloakConfig = {
  url: "https://auth.plott.co.kr",
  realm: "plott",
  clientId: "plott-sandbox",
};

interface AuthContextType {
  authenticated: boolean;
  user: { name: string; email: string; roles: string[] } | null;
  token: string | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  user: null,
  token: null,
  loading: true,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

let kcInstance: Keycloak | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (kcInstance) return; // 중복 초기화 방지

    const kc = new Keycloak(keycloakConfig);
    kcInstance = kc;

    kc.init({
      onLoad: "login-required",
      checkLoginIframe: false,
      pkceMethod: "S256",
    }).then((auth) => {
      if (auth) {
        setAuthenticated(true);
        setToken(kc.token || null);

        const profile = kc.tokenParsed as any;
        setUser({
          name: profile?.name || profile?.preferred_username || "",
          email: profile?.email || "",
          roles: profile?.realm_access?.roles || [],
        });

        // 토큰 자동 갱신 (만료 60초 전)
        setInterval(() => {
          kc.updateToken(60).catch(() => {
            kc.login();
          });
        }, 30000);
      }
      setLoading(false);
    }).catch((err) => {
      console.error("Keycloak init failed:", err);
      setLoading(false);
    });
  }, []);

  const logout = useCallback(() => {
    kcInstance?.logout({ redirectUri: window.location.origin });
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, user, token, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
