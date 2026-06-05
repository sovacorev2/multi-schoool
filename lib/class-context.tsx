"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Class, Session } from "./types";

interface ClassContextType {
  currentClass: Class | null;
  currentSession: Session | null;
  setCurrentClass: (cls: Class | null) => void;
  setCurrentSession: (session: Session | null) => void;
  logout: () => void;
  isLoading: boolean;
  isAdminBypass: boolean;
  setIsAdminBypass: (isAdmin: boolean) => void;
}

const ClassContext = createContext<ClassContextType | undefined>(undefined);

export function ClassProvider({ children }: { children: ReactNode }) {
  const [currentClass, setCurrentClassState] = useState<Class | null>(null);
  const [currentSession, setCurrentSessionState] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminBypass, setIsAdminBypassState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("success_academy_session");
    const storedClass = localStorage.getItem("success_academy_class");
    const storedAdminBypass = localStorage.getItem("success_academy_admin_bypass");
    if (stored) {
      try {
        setCurrentSessionState(JSON.parse(stored));
      } catch {
        localStorage.removeItem("success_academy_session");
      }
    }
    if (storedClass) {
      try {
        setCurrentClassState(JSON.parse(storedClass));
      } catch {
        localStorage.removeItem("success_academy_class");
      }
    }
    if (storedAdminBypass === "true") {
      setIsAdminBypassState(true);
    }
    setIsLoading(false);
  }, []);

  const setCurrentClass = (cls: Class | null) => {
    setCurrentClassState(cls);
    if (cls) {
      localStorage.setItem("success_academy_class", JSON.stringify(cls));
    } else {
      localStorage.removeItem("success_academy_class");
      localStorage.removeItem("success_academy_session");
      setCurrentSessionState(null);
    }
  };

  const setCurrentSession = (session: Session | null) => {
    setCurrentSessionState(session);
    if (session) {
      localStorage.setItem("success_academy_session", JSON.stringify(session));
    } else {
      localStorage.removeItem("success_academy_session");
    }
  };

  const logout = () => {
    setCurrentClassState(null);
    setCurrentSessionState(null);
    setIsAdminBypassState(false);
    localStorage.removeItem("success_academy_class");
    localStorage.removeItem("success_academy_session");
    localStorage.removeItem("success_academy_admin_bypass");
  };

  const setIsAdminBypass = (isAdmin: boolean) => {
    setIsAdminBypassState(isAdmin);
    if (isAdmin) {
      localStorage.setItem("success_academy_admin_bypass", "true");
    } else {
      localStorage.removeItem("success_academy_admin_bypass");
    }
  };

  return (
    <ClassContext.Provider
      value={{
        currentClass,
        currentSession,
        setCurrentClass,
        setCurrentSession,
        logout,
        isLoading,
        isAdminBypass,
        setIsAdminBypass,
      }}
    >
      {children}
    </ClassContext.Provider>
  );
}

export function useClass() {
  const context = useContext(ClassContext);
  if (context === undefined) {
    throw new Error("useClass must be used within a ClassProvider");
  }
  return context;
}
