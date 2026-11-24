import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { DEMO_KEYS, startDemo } from "@/demo/mode";

export const Route = createFileRoute("/demo")({ component: DemoStart });

/** Starts a fresh, isolated demo and opens the Dashboard with the guided tour. */
function DemoStart() {
  useEffect(() => {
    startDemo();
    sessionStorage.setItem(DEMO_KEYS.tour, JSON.stringify({ i: 0, status: "running" }));
    window.location.replace("/");
  }, []);
  return (
    <div className="sx-gate" aria-busy="true">
      <span className="sr-only">Loading the demo</span>
    </div>
  );
}
