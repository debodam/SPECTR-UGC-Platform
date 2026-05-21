import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/lib/spectr-store";

export const Route = createFileRoute("/")({ component: IndexRedirect });

function IndexRedirect() {
  const { state } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (!state.isAuthenticated) navigate({ to: "/login" });
    else if (!state.setupComplete) navigate({ to: "/setup" });
    else navigate({ to: "/transform" });
  }, [state.isAuthenticated, state.setupComplete, navigate]);
  return <div className="min-h-screen" style={{ background: "var(--color-surface)" }} />;
}
