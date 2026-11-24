import { cloneElement, isValidElement, useEffect, useState, type ReactElement } from "react";
import { DEMO_TIP, isDemo } from "./mode";

/**
 * Wraps an action that needs a real account (settings changes, deleting, posting to LinkedIn).
 * Outside the demo it renders the child untouched; in the demo it shows the child disabled with a tooltip.
 */
export function DemoLock({ children }: { children: ReactElement<Record<string, unknown>> }) {
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(isDemo()), []);
  if (!demo || !isValidElement(children)) return children;
  const locked = cloneElement(children, {
    disabled: true,
    "aria-disabled": true,
    href: undefined,
    onClick: (e: { preventDefault: () => void }) => e.preventDefault(),
    title: DEMO_TIP,
  });
  return (
    <span className="demo-lock" data-tip={DEMO_TIP} tabIndex={0} aria-label={DEMO_TIP}>
      {locked}
    </span>
  );
}
