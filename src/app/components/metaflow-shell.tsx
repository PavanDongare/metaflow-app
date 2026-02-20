'use client';

import { useState } from "react";
import { TenantProvider } from "@/lib/auth/tenant-context";
import { MetaflowNav } from "./metaflow-nav";
import { cn } from "@/lib/utils";

export function MetaflowShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [side, setSide] = useState<"left" | "right">(() => {
    if (typeof window === "undefined") return "left";
    const saved = window.localStorage.getItem("metaflow.nav.side");
    return saved === "right" ? "right" : "left";
  });

  const handleSideChange = (next: "left" | "right") => {
    setSide(next);
    window.localStorage.setItem("metaflow.nav.side", next);
  };

  return (
    <TenantProvider
      value={{
        userId: "00000000-0000-0000-0000-000000000002",
        tenantId: "00000000-0000-0000-0000-000000000001",
        isAdmin: false,
      }}
    >
      <div className="h-full flex min-h-0">
        {side === "left" && (
          <MetaflowNav
            orientation="vertical"
            side={side}
            onSideChange={handleSideChange}
          />
        )}
        <main className={cn("flex-1 min-w-0 overflow-auto")}>{children}</main>
        {side === "right" && (
          <MetaflowNav
            orientation="vertical"
            side={side}
            onSideChange={handleSideChange}
          />
        )}
      </div>
    </TenantProvider>
  );
}
