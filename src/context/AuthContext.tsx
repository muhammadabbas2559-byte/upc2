"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { User } from "@/lib/schema";
import * as db from "@/lib/db";
import { logAction, flushLogs } from "@/lib/logger";
import { listPublicUsers } from "@/lib/db";
import type { PublicUser } from "@/lib/db";

// Re-export PublicUser
export type { PublicUser } from "@/lib/db";

interface AuthState {
  /** True once browser-local encrypted storage/session state has been read. */
  authReady: boolean;
  bootstrapped: boolean;
  publicUsers: PublicUser[];
  currentUser: User | null;
  login: (username: string, password: string) => Promise<void>;
  bootstrap: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  switchUser: (userId: string, suPassword?: string) => Promise<void>;
  createUser: (
    username: string,
    password: string,
    displayName: string,
    suPassword: string
  ) => Promise<User>;
  deleteUser: (userId: string, suPassword: string) => Promise<void>;
  refresh: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [publicUsers, setPublicUsers] = useState<PublicUser[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const refresh = useCallback(() => {
    setBootstrapped(db.isBootstrapped());
    setPublicUsers(listPublicUsers());
    setCurrentUser(db.getCurrentUser());
    setAuthReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const u = await db.login(username, password);
    setCurrentUser(u);
    logAction("login", { username });
    flushLogs();
  };

  const bootstrap = async (username: string, password: string, displayName?: string) => {
    const u = await db.bootstrap(username, password, displayName);
    setCurrentUser(u);
    logAction("bootstrap", { username: u.username });
    flushLogs();
    refresh();
  };

  const logout = () => {
    logAction("logout");
    flushLogs();
    db.lock();
    setCurrentUser(null);
  };

  const switchUser = async (userId: string, suPassword?: string) => {
    const u = await db.switchToUser(userId, suPassword);
    setCurrentUser(u);
    logAction("switch_user", { to: u.username });
    flushLogs();
  };

  const createUser = async (
    username: string,
    password: string,
    displayName: string,
    suPassword: string
  ) => {
    const u = await db.createUser(username, password, displayName, suPassword);
    logAction("create_user", { newUser: u.username });
    flushLogs();
    refresh();
    return u;
  };

  const deleteUser = async (userId: string, suPassword: string) => {
    await db.deleteUser(userId, suPassword);
    logAction("delete_user", { userId });
    flushLogs();
    refresh();
  };

  return (
    <AuthCtx.Provider
      value={{
        authReady,
        bootstrapped,
        publicUsers,
        currentUser,
        login,
        bootstrap,
        logout,
        switchUser,
        createUser,
        deleteUser,
        refresh,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
