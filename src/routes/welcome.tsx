import { createFileRoute, redirect } from "@tanstack/react-router";

// The landing page moved to the root (tryspectr.online/). Old /welcome links keep working.
export const Route = createFileRoute("/welcome")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
