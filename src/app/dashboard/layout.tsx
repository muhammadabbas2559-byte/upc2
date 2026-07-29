"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

function Gate({ children }: { children: React.ReactNode }) {
  const { authReady, currentUser, bootstrapped } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Never make an authorization decision from the provider's initial
    // placeholder values; wait until browser-local state has been restored.
    if (!authReady) return;
    if (!bootstrapped || !currentUser) {
      setReady(false);
      router.replace("/");
      return;
    }
    setReady(true);
  }, [authReady, bootstrapped, currentUser, router]);

  if (!authReady || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="pulse-dot mx-auto mb-3 w-3 h-3"></div>
          <div className="text-muted text-sm">Verifying encrypted session...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <Gate>{children}</Gate>
    </DataProvider>
  );
}
