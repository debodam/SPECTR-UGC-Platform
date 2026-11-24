import { DemoBlockedError, isDemo, noteDemoBlocked } from "@/demo/mode";

/**
 * The one client-side door to the AI server functions. In demo mode it refuses before any request is built,
 * shows a calm "Not available in demo" note and throws, so callers fall back to their sample output.
 * The network guard in demo/mode.ts is a second wall behind this one.
 */
export async function callAI<T>(run: () => Promise<T>): Promise<T> {
  if (isDemo()) {
    noteDemoBlocked();
    throw new DemoBlockedError();
  }
  return run();
}
