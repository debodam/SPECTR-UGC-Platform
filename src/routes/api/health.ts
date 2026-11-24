import { createFileRoute } from "@tanstack/react-router";

/** Uptime check for Vercel or any monitor: GET /api/health returns 200 with a tiny JSON body. */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        }),
    },
  },
});
