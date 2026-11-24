// Fictional demo company. Everything here is invented for the SPECTR demo.
export const DEMO_USER = {
  id: "demo-user-maya",
  name: "Maya Okafor",
  email: "maya@rampwise.example",
  title: "Co-founder and CEO",
};

export const DEMO_COMPANY_ID = "demo-company-rampwise";

export const DEMO_WORKSPACE = {
  companyId: DEMO_COMPANY_ID,
  companyName: "Rampwise",
  companyLogoUrl: "", // use an initial tile "R" in the UI if empty
  industry: "Software & SaaS",
  primaryPlatform: "LinkedIn" as const,
  startingFromScratch: false,
  companyDescription:
    "Rampwise is an AI onboarding copilot for B2B SaaS customer success teams. It reads each new customer's contract, kickoff call and early product usage, builds a personalized 30 day onboarding plan around the one outcome that customer bought for, and alerts both the CSM and the customer champion the moment onboarding stalls. Founded in 2024. Seed stage, 11 people, 38 paying customers, mostly mid-market SaaS and fintech teams.",
  companyPdfUrl: "",
  companyPdfName: "",
  goalDescription:
    "Become the go-to voice on customer onboarding for B2B SaaS. Grow our LinkedIn following with customer success and RevOps leaders so we get more inbound demo requests, stronger candidate interest for our first two CS hires, and warmer intros to Series A investors.",
  baseline: {
    followers: "2140",
    followerGrowth: "18",
    weeklyImpressions: "4200",
    engagementRate: "2.4",
    monthlyVisitors: "310",
    weeklyPageSearches: "64",
  },
  targets: {
    followers: "4000",
    followerGrowth: "150",
    weeklyImpressions: "18000",
    engagementRate: "4.5",
    monthlyVisitors: "1200",
    weeklyPageSearches: "220",
  },
  growthPrefs: {
    focus: "Grow followers",
    weeklyTime: "3 to 5 hours",
    formats: ["Posts", "Articles", "Video scripts"],
    topics: "customer onboarding, time to first value, customer retention, founder lessons",
    voice: "Direct",
  },
  audience: {
    jobTitles:
      "VP Customer Success, Head of Onboarding, Director of RevOps, Chief Customer Officer, Head of Implementation",
    seniority: "Senior Manager / Director",
    companySize: "Mid-Market",
    description:
      "Customer success and revenue operations leaders at B2B SaaS companies with 50 to 500 employees. They own onboarding and net revenue retention, they are tired of generic checklists, and they trust practitioners who share real numbers over vendors who share slogans. Secondary audience: founders of earlier stage SaaS companies hiring their first CS lead.",
  },
};

// Optional second workspace so the Workspaces screen has more than one card.
export const DEMO_SECONDARY_WORKSPACES = [
  {
    companyId: "demo-company-tideline",
    companyName: "Tideline Health",
    industry: "Healthcare Technology",
    setupComplete: true,
    note: "Lightly seeded: setup done, a few entries, no plays yet. Used to show multi-workspace switching.",
    baseline: {
      followers: "860",
      followerGrowth: "9",
      weeklyImpressions: "1800",
      engagementRate: "2.0",
      monthlyVisitors: "120",
      weeklyPageSearches: "22",
    },
    targets: {
      followers: "1800",
      followerGrowth: "40",
      weeklyImpressions: "7000",
      engagementRate: "3.5",
      monthlyVisitors: "400",
      weeklyPageSearches: "80",
    },
  },
];

export const DEMO_SAVED_CONTEXTS = [
  {
    name: "Rampwise voice and tone",
    text: "Write like a practitioner talking to a peer. Plain words, short sentences, specific numbers, no hype and no buzzwords like synergy or game-changing. Start with the situation, then the lesson. First person singular when it is Maya, first person plural when it is the team. Never claim results we cannot back with a number. No em dashes.",
  },
  {
    name: "Customer proof points",
    text: "Cobalt Ledger (fintech, 240 employees): average time to first value fell from 41 days to 19 days over eight weeks. Day seven activation rose from about 50 percent to 68 percent after we ended kickoff calls with a named owner and a date. Across 38 customers, the most common stall at day nine is a missing approver, not a product problem.",
  },
  {
    name: "Positioning and what we are not",
    text: "Rampwise is not a CRM, not a checklist tool, and not a chatbot. It is an onboarding copilot that builds the plan around the single outcome a customer bought for and tells both sides when something stalls. Competes with spreadsheets, generic CS platforms and ad hoc Slack channels. Do not name competitors in public content.",
  },
];
