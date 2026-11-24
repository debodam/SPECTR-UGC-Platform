// Fictional demo company. Everything here is invented for the SPECTR demo.
export const DEMO_USER = {
  id: "demo-user-marcus",
  name: "Marcus Bell",
  email: "marcus@fastbreak.example",
  title: "Co-founder and CEO",
};

export const DEMO_COMPANY_ID = "demo-company-fastbreak";

export const DEMO_WORKSPACE = {
  companyId: DEMO_COMPANY_ID,
  companyName: "Fastbreak AI",
  companyLogoUrl: "", // use an initial tile "F" in the UI if empty
  industry: "Software & SaaS",
  primaryPlatform: "LinkedIn" as const,
  startingFromScratch: false,
  companyDescription:
    "Fastbreak AI is an AI coach for basketball and team athletes. It builds each player a personalized weekly training program from their goals, schedule, workload and game film, adjusts it after every session, and alerts the coach and the athlete when fatigue or form starts to slip. Founded in 2024 by Marcus Bell, a former college point guard and strength coach. Seed stage, 9 people, 24 teams and academies, about 1,900 athletes, mostly high school programs, AAU clubs and college teams.",
  companyPdfUrl: "",
  companyPdfName: "",
  goalDescription:
    "Become the most trusted voice on athlete development for coaches and athletic directors. Grow our LinkedIn following with coaches, performance staff and club directors so we get more team demo requests, stronger interest from performance coaches we want to hire, and warmer intros to investors.",
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
    topics: "athlete development, basketball training, load management, coaching lessons",
    voice: "Direct",
  },
  audience: {
    jobTitles:
      "Head Coach, Director of Player Development, Strength and Conditioning Coach, Athletic Director, Club Director",
    seniority: "Manager",
    companySize: "SMB",
    description:
      "Coaches and performance staff who run basketball programs at high schools, AAU clubs and colleges, plus athletic directors and club directors who choose training tools. They are short on time, tired of copy and paste workouts, and trust practitioners who share real programs and real numbers over brands that share hype. Secondary audience: former athletes starting their own training businesses.",
  },
};

// Optional second workspace so the Workspaces screen has more than one card.
export const DEMO_SECONDARY_WORKSPACES = [
  {
    companyId: "demo-company-stridelab",
    companyName: "Stride Lab",
    industry: "Software & SaaS",
    setupComplete: true,
    note: "Lightly seeded: setup done, a few entries, no plays yet. Used to show multi-workspace switching.",
    baseline: { followers: "860", followerGrowth: "9", weeklyImpressions: "1800", engagementRate: "2.0", monthlyVisitors: "120", weeklyPageSearches: "22" },
    targets: { followers: "1800", followerGrowth: "40", weeklyImpressions: "7000", engagementRate: "3.5", monthlyVisitors: "400", weeklyPageSearches: "80" },
  },
];

export const DEMO_SAVED_CONTEXTS = [
  {
    name: "Fastbreak voice and tone",
    text: "Write like a coach talking to another coach. Plain words, short sentences, specific numbers, no hype and no clichés like game changer or next level. Start with the situation, then the lesson. First person singular when it is Marcus, first person plural when it is the team. Never claim a result we cannot back with a number. No em dashes.",
  },
  {
    name: "Athlete proof points",
    text: "Eastgate High guard Jordan: free throw percentage rose from 61 to 74 over 8 weeks after we moved free throws to the end of practice under fatigue. Across 14 high school guards on our 6 week program, average vertical jump rose 3.5 inches and nobody missed practice with a soft tissue injury. Most common early warning sign of a bad week: two days in a row of leg heaviness reports at 4 or 5 out of 5.",
  },
  {
    name: "Positioning and what we are not",
    text: "Fastbreak is not a workout library, not a wearable and not a replacement for the coach. It is an AI coach that builds each athlete's week from their goals, schedule and workload, adjusts after every session, and tells the coach when something is off. Competes with spreadsheets, copy and paste workouts and generic fitness apps. Do not name competitors in public content.",
  },
];
