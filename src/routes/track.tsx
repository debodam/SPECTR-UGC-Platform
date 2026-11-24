import { createFileRoute, redirect } from "@tanstack/react-router";

// Track was renamed to Results. Old links keep working.
export const Route = createFileRoute("/track")({
  beforeLoad: () => { throw redirect({ to: "/results", replace: true }); },
});
