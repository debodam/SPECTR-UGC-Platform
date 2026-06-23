import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/lib/spectr-store";

export const Route = createFileRoute("/")({ component: IndexRedirect });

function IndexRedirect() {
  const { state } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/access" });
    else if (state.setupComplete && state.workspace?.companyId) navigate({ to: "/transform" });
    else navigate({ to: "/companies" });
  }, [state.authLoading, state.isAuthenticated, state.setupComplete, navigate]);
  return <div className="min-h-screen" />;
}
