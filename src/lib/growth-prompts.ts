import type { Workspace } from "./spectr-store";
import type { Play, PlayType } from "./growth-types";

/** Questions to speak to while recording a play, specific to the play type and workspace. */
export function guidedPrompts(play: Play, ws: Workspace): string[] {
  const company = ws.companyName || "your company";
  const sector = ws.industry || "your market";
  const role = (ws.audience.jobTitles.split(/[,;/]/)[0] || "your buyers").trim();
  const roles = /s$/i.test(role) ? role : `${role}s`;
  const byType: Record<PlayType, string[]> = {
    "founder story": [
      `What moment made you start ${company}?`,
      `What were ${roles} in ${sector} struggling with before?`,
      "What did you try first that did not work?",
      `What would you tell ${roles} facing that problem today?`,
    ],
    "contrarian take": [
      `What does almost everyone in ${sector} believe that you disagree with?`,
      "What evidence or experience changed your mind?",
      "What happens to teams that keep doing it the old way?",
      `What should ${roles} do instead this week?`,
    ],
    "customer win": [
      "Who was the customer and what was stuck before?",
      "What did you change together, step by step?",
      "Which number moved, and by how much?",
      `What can other ${roles} copy from it?`,
    ],
    "build in public": [
      "What did you ship or decide this week?",
      `What did ${roles} tell you that surprised you?`,
      "What would you do differently?",
      "What is next, and why?",
    ],
    launch: [
      `What are you launching, and for which ${roles}?`,
      "What problem does it solve that was painful before?",
      "Describe one concrete before and after.",
      "How can people try it today?",
    ],
    hiring: [
      "Who are you hiring, and why now?",
      "What will this person own in their first 90 days?",
      `Why is ${company} a great place for them to do their best work?`,
      "How should good candidates reach you?",
    ],
    "how-to": [
      `What outcome does this help ${roles} get?`,
      "Walk through the first step and why it matters.",
      "Cover the next steps, with one example each.",
      "What is the most common mistake to avoid?",
    ],
  };
  return byType[play.type] ?? byType["how-to"];
}
