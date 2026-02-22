'use client';

import { useState } from "react";
import { TenantProvider } from "@/lib/auth/tenant-context";
import { MetaflowNav } from "./metaflow-nav";
import { UserNav } from "@/components/navigation/user-nav";
import { cn } from "@/lib/utils";
import type { UserContext } from "@/lib/auth/get-user-context";

export function MetaflowShell({
  children,
  userContext,
}: Readonly<{ children: React.ReactNode; userContext: UserContext | null }>) {
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
        userId: userContext?.userId ?? "00000000-0000-0000-0000-000000000002",
        tenantId: userContext?.tenantId ?? "00000000-0000-0000-0000-000000000001",
        isAdmin: userContext?.isAdmin ?? false,
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {userContext && <UserNav email={userContext.email} />}
        <div className="flex-1 flex min-h-0 overflow-hidden">
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
      </div>
    </TenantProvider>
  );
}
