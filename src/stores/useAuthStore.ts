import { create } from "zustand";
import type { User } from "@/lib/utils/permissions";
import { clearApiGetCache } from "@/lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  authLoading: boolean;
  setUser: (user: User | null) => void;
  login: (user: User, token: string, expiresAt: string) => void;
  logout: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  authLoading: true,

  setUser: (user) => set({ user }),

  login: (user, token, expiresAt) => {
    clearApiGetCache();
    if (typeof window !== "undefined") {
      localStorage.setItem("sessionUser", JSON.stringify(user));
      localStorage.setItem("authToken", token);
      localStorage.setItem("tokenExpiresAt", expiresAt);
    }
    set({ user, token, authLoading: false });
  },

  logout: () => {
    clearApiGetCache();
    if (typeof window !== "undefined") {
      localStorage.removeItem("sessionUser");
      localStorage.removeItem("authToken");
      localStorage.removeItem("tokenExpiresAt");
    }
    set({ user: null, token: null });
  },

  initAuth: () => {
    if (typeof window === "undefined") {
      set({ authLoading: false });
      return;
    }

    const storedUser = localStorage.getItem("sessionUser");
    const storedToken = localStorage.getItem("authToken");
    const expiresAt = localStorage.getItem("tokenExpiresAt");

    if (storedUser && storedToken && expiresAt) {
      const expiryTime = Number(expiresAt);
      if (Date.now() < expiryTime) {
        set({
          user: JSON.parse(storedUser),
          token: storedToken,
          authLoading: false,
        });

        // Auto-logout timer
        const timeUntilExpiry = expiryTime - Date.now();
        setTimeout(() => {
          useAuthStore.getState().logout();
          window.location.href = "/login";
        }, timeUntilExpiry);
      } else {
        // Token expired
        clearApiGetCache();
        localStorage.removeItem("sessionUser");
        localStorage.removeItem("authToken");
        localStorage.removeItem("tokenExpiresAt");
        set({ user: null, token: null, authLoading: false });
      }
    } else {
      set({ authLoading: false });
    }
  },
}));
