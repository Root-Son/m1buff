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

const KC_TOKEN_KEY = "kc_token";
const KC_REFRESH_KEY = "kc_refresh_token";
const KC_ID_KEY = "kc_id_token";

function saveTokens(kc: Keycloak) {
  if (kc.token) localStorage.setItem(KC_TOKEN_KEY, kc.token);
  if (kc.refreshToken) localStorage.setItem(KC_REFRESH_KEY, kc.refreshToken);
  if (kc.idToken) localStorage.setItem(KC_ID_KEY, kc.idToken);
}

function clearTokens() {
  localStorage.removeItem(KC_TOKEN_KEY);
  localStorage.removeItem(KC_REFRESH_KEY);
  localStorage.removeItem(KC_ID_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (kcInstance) return; // 중복 초기화 방지

    const kc = new Keycloak(keycloakConfig);
    kcInstance = kc;

    // localStorage에서 저장된 토큰 복원
    const savedToken = localStorage.getItem(KC_TOKEN_KEY) || undefined;
    const savedRefresh = localStorage.getItem(KC_REFRESH_KEY) || undefined;
    const savedId = localStorage.getItem(KC_ID_KEY) || undefined;

    kc.init({
      onLoad: "login-required",
      checkLoginIframe: false,
      pkceMethod: "S256",
      token: savedToken,
      refreshToken: savedRefresh,
      idToken: savedId,
    }).then((auth) => {
      if (auth) {
        // 저장된 토큰으로 복원된 경우 즉시 갱신 시도
        kc.updateToken(300).then(() => {
          saveTokens(kc);
          setAuthenticated(true);
          setToken(kc.token || null);

          const profile = kc.tokenParsed as any;
          setUser({
            name: profile?.name || profile?.preferred_username || "",
            email: profile?.email || "",
            roles: profile?.realm_access?.roles || [],
          });
          setLoading(false);
        }).catch(() => {
          // refresh token도 만료 → 재로그인
          clearTokens();
          kc.login();
        });

        const refreshToken = () => {
          kc.updateToken(120).then((refreshed) => {
            if (refreshed) {
              saveTokens(kc);
              setToken(kc.token || null);
            }
          }).catch(() => {
            clearTokens();
            kc.login();
          });
        };

        // 토큰 만료 이벤트 핸들러
        kc.onTokenExpired = refreshToken;

        // 주기적 갱신 (만료 120초 전)
        setInterval(refreshToken, 30000);

        // 탭 복귀 시 즉시 갱신
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") refreshToken();
        });
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error("Keycloak init failed:", err);
      clearTokens();
      setLoading(false);
    });
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    kcInstance?.logout({ redirectUri: window.location.origin });
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, user, token, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
