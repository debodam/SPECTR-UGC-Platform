import { lazy, Suspense, useEffect, useState } from "react";
import { isDemo } from "@/demo/mode";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { SpectrProvider } from "@/lib/spectr-store";
import { Toaster } from "@/components/ui/sonner";
import { friendlyError } from "@/lib/utils";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center spectr-card p-8">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          This page doesn't exist.
        </p>
        <Link to="/" className="mt-6 inline-block spectr-btn-primary px-4">
          Go to app
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center spectr-card p-8">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {friendlyError(error, "This page hit an unexpected problem. Your saved work is safe.")}
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 spectr-btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SPECTR - Content Transformation Engine" },
      {
        name: "description",
        content:
          "Transform raw expert material into a full B2B content ecosystem and track what performs.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Archivo:wght@700;800;900&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function PageTransition() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={pathname} className="spectr-page-in">
      <Outlet />
    </div>
  );
}

const DemoLayer = lazy(() => import("@/demo/DemoLayer"));

/** Loads the demo chrome and tour only in a demo tab. */
function DemoMount() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(isDemo()), []);
  return on ? (
    <Suspense fallback={null}>
      <DemoLayer />
    </Suspense>
  ) : null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SpectrProvider>
        <PageTransition />
        <Toaster position="bottom-right" />
        <DemoMount />
      </SpectrProvider>
    </QueryClientProvider>
  );
}
