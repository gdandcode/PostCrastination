import {clampModule,modulesOverlap,moduleCollides,planModulePlacement} from './moduleLayout.mjs';
import LearningWorkspace from './LearningWorkspace';
import Resources from './Resources';
import NotificationMenu from './NotificationMenu';
import {useSchoolFeatures} from './useSchoolFeatures';
import SchoolAdmin from "./SchoolAdmin";
import {loginEmail as loginEmailAccount,loginGoogle} from "./loginApi";
import { resolveWorkspaceView } from "./workspaceRouting.mjs";
import Behaviour from './Behaviour';
import StudentSidebar from './StudentSidebar';
import PersonalTasks, {usePersonalTasks} from './PersonalTasks';
import Gradebook from './Gradebook';
import { LiveTeacher, LiveStudent, useLiveSchool } from './LiveSchool';
import ExternalAccountSetup from "./ExternalAccountSetup";
import CommunityPage, { CommunityAccountSync } from "./CommunityPage";
import { syncCommunityUser } from "./communityApi";
import { useSchoolData } from './schoolStore';
import { schoolTasks, DEMO_STUDENT } from './schoolModel';
import { SchoolEntry, SchoolDemoNav, TeacherDashboard, StudentSchoolSpace } from "./SchoolPrototype";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db, firebaseReady, googleProvider } from "./firebase";

/*
  Postcrastination React Prototype
  Debug fix:
  - Removed lucide-react dependency because some build environments fetch lucide icons from CDN URLs.
  - Replaced all icons with local inline SVG components, so the app can build without external icon imports.
  - Added lightweight self-tests for date logic, task sorting, and theme updates.
*/

/*
  FUTURE AI / CODEX HANDOFF NOTES

  App name:
  - Postcrastination

  What this app is:
  - A student focus and studying app that helps students start studying, plan work, stay focused,
    track Pomodoro progress, and generate study schedules.
  - Visual style should stay glassmorphism / frosted glass with a black, purple, and orange gradient
    background.
  - The app is currently a React/Vite frontend and also has an Electron desktop wrapper.

  Current project folders:
  - Source/prototype file:
    C:\Users\potat\OneDrive - Nord Anglia Education\Desktop\react prototype postcrastination (RPTPC)\index.jsx
  - Runnable Vite/Electron app:
    C:\Users\potat\postcrastination
  - After editing this source file, copy it into the live Vite app:
    Copy-Item "C:\Users\potat\OneDrive - Nord Anglia Education\Desktop\react prototype postcrastination (RPTPC)\index.jsx" "C:\Users\potat\postcrastination\src\App.jsx" -Force
  - Run the app:
    cd C:\Users\potat\postcrastination
    npm.cmd run desktop

  Current main user-facing areas:
  - Home page with placeholder company intro.
  - Frosted glass top taskbar/nav.
  - Pricing page placeholder.
  - Fake login flow.
  - Accounts dropdown after login with Dashboard, AI planner, Settings, and Log out.
  - Dashboard with three swipe/page cards:
    1. Task creator + weekly calendar.
    2. Main study dashboard with Pomodoro, goal completion, overview, AI assistant, and music player.
    3. Right-side WIP module.
  - Settings page placeholder.
  - AI planner page.

  Important implementation details:
  - Tailwind CSS is used through Vite/Tailwind. The app relies heavily on Tailwind utility classes.
  - Framer Motion is used, but animations were reduced because FPS was choppy.
  - Local state is persisted with localStorage through useLocalCacheState().
  - The dashboard should fit inside the visible page without requiring scroll.
  - Avoid oversized cards or content overlap. The goal gauge previously overlapped the music player,
    so keep top widgets compact and use overflow-hidden where needed.

  Pomodoro / goal behavior:
  - The Pomodoro widget has custom work/rest intervals.
  - Goal completion should update automatically every completed Pomodoro minute while the timer runs.
  - The user should not manually enter completed time anymore.
  - The goal settings popup only edits the target goal time.

  AI planner behavior:
  - The AI planner should let the user write a normal prompt, not just enter "study items".
  - Prompt should support:
    - What the student needs to study.
    - Preferred Pomodoro method, such as 25/5, 50/10, or 90/20.
    - Existing events during the day.
    - Available from/until times.
    - Whether to include sleep prep and wake-up guidance.
  - The AI/backend can return JSON internally, but raw JSON should NOT be displayed to the user.
  - The app should read the JSON internally and render calendar-style event cards.
  - Use active recall, spacing, Pomodoro blocks, breaks, sleep prep, and learning science reasoning
    such as retrieval practice, spacing effect, cognitive load, sleep consolidation, and neuroplasticity.

  API key safety:
  - Never put API keys in this React file or any frontend code.
  - The OpenRouter key is stored locally in:
    C:\Users\potat\postcrastination\api.env
  - api.env and .env must stay in .gitignore.
  - Electron main process reads the API key with dotenv.
  - React calls Electron through preload IPC, so the key stays in the backend.

  Electron backend:
  - electron-main.cjs handles:
    - OpenRouter schedule generation through ipcMain handle "ai:create-schedule".
    - Windows media detection through ipcMain handle "media:get-current".
  - preload.cjs exposes:
    - window.postcrastinationAI.createSchedule(payload)
    - window.postcrastinationMedia.getCurrent()

  Music player / Windows media:
  - The music widget should show Windows currently playing media when the Electron desktop app can detect it.
  - Package installed for Windows SMTC:
    @coooookies/windows-smtc-monitor
  - It runs through smtc-worker.cjs because the package recommends using a worker thread in Electron.
  - If no Windows media is playing, fallback should simply say "No media playing" and should not show
    progress sliders or controls.
  - The player currently works according to the user.

  Design preferences from the user:
  - Use frosted glass / glassmorphism.
  - Purple, orange, black gradient background.
  - Cards should be visible and usable, but not so big that the page needs scrolling.
  - Text and titles must not overlap.
  - Keep responses concise when helping in future chats because the user asked to use fewer tokens.

  Things to avoid:
  - Do not expose API keys.
  - Do not make the app require page scroll on the main dashboard.
  - Do not display raw AI JSON to the user.
  - Do not make the fallback music player look like a fake player with sliders when no media is playing.
*/
// AI planner note: frontend uses a local JSON planner. Put real API calls behind a backend or Electron main process.
/*
  Windows setup / run notes:
  1. Install Node.js LTS from https://nodejs.org/.
  2. Create a React app if you do not already have one:
     npm.cmd create vite@latest postcrastination -- --template react
  3. Open the new folder, then install this prototype's dependency:
     npm.cmd install framer-motion
  4. Copy this file into the app as src/App.jsx, replacing the starter App file.
  5. Start the dev server:
     npm.cmd run dev
  6. Open the local URL Vite prints, usually http://localhost:5173/.

  If PowerShell says npm.ps1 cannot be loaded, use npm.cmd as shown above.
*/
const Icon = memo(function Icon({ name, size = 20, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const paths = {
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    settings: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    play: <path d="M8 5v14l11-7Z" />,
    pause: (
      <>
        <path d="M10 4v16" />
        <path d="M14 4v16" />
      </>
    ),
    rotate: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v6h6" />
      </>
    ),
    skipBack: (
      <>
        <path d="M19 20 9 12l10-8v16Z" />
        <path d="M5 19V5" />
      </>
    ),
    skipForward: (
      <>
        <path d="m5 4 10 8-10 8V4Z" />
        <path d="M19 5v14" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
    bot: (
      <>
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M12 8V4" />
        <circle cx="12" cy="3" r="1" />
        <path d="M8 12h.01" />
        <path d="M16 12h.01" />
        <path d="M9 16h6" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 21v-7" />
        <path d="M4 10V3" />
        <path d="M12 21v-9" />
        <path d="M12 8V3" />
        <path d="M20 21v-5" />
        <path d="M20 12V3" />
        <path d="M2 14h4" />
        <path d="M10 8h4" />
        <path d="M18 16h4" />
      </>
    ),
    image: (
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </>
    ),
    check: (
      <>
        <path d="M20 6 9 17l-5-5" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
        <path d="M5 5H3v3a4 4 0 0 0 4 4" />
        <path d="M19 5h2v3a4 4 0 0 1-4 4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.settings}</svg>;
});

const defaultTheme = {
  mode: "light",
  glassEnabled: false,
  appName: "Postcrastination",
  backgroundType: "gradient",
  backgroundImage: "",
  colors: {
    base: "#050505",
    surface: "#12081f",
    orange: "#ff8a1f",
    purple: "#7c3aed",
    gold: "#facc15",
    danger: "#ef4444",
    success: "#22c55e",
    warning: "#facc15",
    glass: "rgba(255,255,255,0.08)",
    glassStrong: "rgba(255,255,255,0.14)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.68)",
    border: "rgba(255,255,255,0.18)",
  },
};

const themePalettes = {
  contrast: { base: "#000000", surface: "#000000", text: "#ffffff", muted: "#ffffff", border: "#ffffff", glass: "#000000", glassStrong: "#151515", purple: "#ffff00", orange: "#ffff00", gold: "#ffff00", danger: "#ff9999" },
  light: { base: "#f5f5fa", surface: "#ffffff", text: "#222334", muted: "#626477", border: "#dedee8", glass: "#ffffff", glassStrong: "#ededf5", purple: "#7151c6", orange: "#ad5317", gold: "#806112" },
  dark: { base: "#17181f", surface: "#23252f", text: "#f2f1f7", muted: "#b4b5c4", border: "#40424e", glass: "#23252f", glassStrong: "#30323e", purple: "#b69aef", orange: "#ffb078", gold: "#e3c66b" },
};
function resolveTheme(theme, deviceDark) {
  const mode = theme.mode || "light";
  const palette = mode === "system" ? (deviceDark ? "dark" : "light") : mode;
  return { ...theme, mode, palette, glassEnabled: palette === "contrast" ? false : (theme.glassEnabled ?? false),
    colors: { ...defaultTheme.colors, ...(palette === "custom" ? theme.colors : themePalettes[palette]) } };
}

function buildThemeVars(theme) {
  const colors = { ...defaultTheme.colors, ...(theme?.colors || {}) };
  return {
    "--pc-base": colors.base,
    "--pc-surface": colors.surface,
    "--pc-orange": colors.orange,
    "--pc-purple": colors.purple,
    "--pc-gold": colors.gold,
    "--pc-danger": colors.danger,
    "--pc-success": colors.success,
    "--pc-warning": colors.warning,
    "--pc-glass": colors.glass,
    "--pc-glass-strong": colors.glassStrong,
    "--pc-text": colors.text,
    "--pc-muted": colors.muted,
    "--pc-border": colors.border,
  };
}

const initialTasks = [
  {
    id: 1,
    name: "Revise physiology lecture notes",
    urgency: "High",
    dueDate: "2026-05-14",
    labels: ["Biomed", "Revision"],
  },
  {
    id: 2,
    name: "Submit housing form",
    urgency: "Medium",
    dueDate: "2026-05-16",
    labels: ["Admin"],
  },
];

const widgetCatalog = [
  { id: "pomodoro", name: "Pomodoro timer", defaultSize: "6 x 3", defaultLayout: { x: 1, y: 1, w: 6, h: 3 } },
  { id: "goal", name: "Goal completion", defaultSize: "6 x 3", defaultLayout: { x: 7, y: 1, w: 6, h: 3 } },
  { id: "taskCreator", name: "Task creator", defaultSize: "4 x 3", defaultLayout: { x: 1, y: 1, w: 4, h: 3 } },
  { id: "overview", name: "Daily/weekly overview", defaultSize: "5 x 3", defaultLayout: { x: 1, y: 4, w: 5, h: 3 } },
  { id: "ai", name: "AI assistant", defaultSize: "3 x 3", defaultLayout: { x: 6, y: 4, w: 3, h: 3 } },
  { id: "music", name: "Music player", defaultSize: "4 x 3", defaultLayout: { x: 9, y: 4, w: 4, h: 3 } },
];

const moduleSizePresets = [
  { label: "3 x 3", w: 3, h: 3 },
  { label: "4 x 3", w: 4, h: 3 },
  { label: "5 x 3", w: 5, h: 3 },
  { label: "6 x 3", w: 6, h: 3 },
  { label: "3 x 6", w: 3, h: 6 },
  { label: "6 x 6", w: 6, h: 6 },
  { label: "12 x 3", w: 12, h: 3 },
  { label: "12 x 6", w: 12, h: 6 },
];

const defaultModules = ["pomodoro", "goal", "overview", "ai", "music"].map((id) => ({
  id,
  ...widgetCatalog.find((widget) => widget.id === id).defaultLayout,
}));

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function toISODateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthCalendarCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const day = i - startOffset + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
}

function getCurrentWeek(today = new Date()) {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { date, iso: toISODateLocal(date) };
  });
}

function sortTasksByDueDate(tasks) {
  return [...tasks].sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
}

function formatPlaybackTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60).toString();
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function parsePlannerTasks(text) {
  return text
    .split(/\n|,/)
    .map((task) => task.trim())
    .filter(Boolean)
    .slice(0, 8);
}
//todo theres a problem with the ai planner, tthat whenever i try to delete the sample prompt, it always reappears. plz fix
function createLocalStudyPlan({ prompt, tasksText, existingEvents, pomodoroMethod, availableFrom, availableTo, includeSleep }) {
  const promptText = prompt || tasksText || "Review notes, practice active recall, complete homework";
  const tasks = parsePlannerTasks(promptText);
  const events = parsePlannerTasks(existingEvents || "");
  const startHour = Number((availableFrom || "16:00").split(":")[0]) || 16;
  const method = pomodoroMethod || "25/5 Pomodoro";

  const schedule = tasks.map((task, index) => {
    const start = startHour * 60 + index * 70;
    const end = start + 50;
    const time = (minutes) => `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
    return {
      start: time(start),
      end: time(end),
      title: task,
      method: index % 2 === 0 ? `${method} + active recall` : `${method} + spaced practice`,
      reason:
        index % 2 === 0
          ? "Retrieval practice strengthens recall and keeps cognitive load manageable."
          : "Spacing and worked practice help neuroplasticity by revisiting the material with effort.",
    };
  });

  const fixedEvents = events.map((event, index) => ({
    start: "Busy",
    end: "Busy",
    title: event,
    method: "Fixed event",
    reason: "Kept from your day plan so study blocks can fit around it.",
    type: "event",
    order: index,
  }));

  return {
    summary: `Draft plan for ${tasks.length} study item${tasks.length === 1 ? "" : "s"} between ${availableFrom || "16:00"} and ${availableTo || "20:00"}.`,
    assumptions: [`Preferred method: ${method}`, "Breaks included between focus blocks", "Harder tasks placed earlier when possible"],
    schedule: [...fixedEvents, ...schedule],
    tasks: tasks.map((task, index) => ({
      name: task,
      priority: index === 0 ? "High" : index < 3 ? "Medium" : "Low",
      deadline: "Not set",
      plan: "Use active recall first, then check notes to repair gaps.",
    })),
    sleep: includeSleep
      ? {
          preparation: "Start winding down 45-60 minutes before bed; avoid intense revision in the final block.",
          wakeUp: "Wake at a consistent time and do a 10 minute recall warm-up.",
        }
      : {
          preparation: "Not requested",
          wakeUp: "Not requested",
        },
    warnings: ["This is a draft schedule. Adjust it if deadlines, energy, or sleep needs change."],
  };
}

function readScheduleEvents(scheduleJson) {
  const events = Array.isArray(scheduleJson?.schedule) ? scheduleJson.schedule : [];
  return events.map((item, index) => ({
    id: `${item.start || "event"}-${item.end || index}-${item.title || index}`,
    start: item.start || "TBD",
    end: item.end || "TBD",
    title: item.title || "Study block",
    method: item.method || "Study",
    reason: item.reason || "Planned study time.",
    type: item.type || (item.method === "Fixed event" ? "event" : "study"),
  }));
}

function updateThemeColor(theme, key, value) {
  return {
    ...theme,
    colors: { ...theme.colors, [key]: value },
  };
}

const STORAGE_PREFIX = "postcrastination:";
const DEFAULT_PFP = "/nopfp.png";
const ALEXANDER_PROFILE = {
  uid: "seed-alexander",
  userId: 1,
  username: "AlexanderManno_",
  photoURL: DEFAULT_PFP,
  studyLocation: "London library",
  profileVisibility: "public",
  totalStudyMinutes: 12480,
  currentStreak: 18,
  longestStreak: 64,
  weekendsCount: true,
};

const achievementGroups = [
  {
    key: "studyMinutes",
    label: "Total time studied",
    unit: "hours",
    milestones: [
      [1, "Starting", "Everyone starts somewhere."],
      [5, "Good", "The warm-up arc is complete."],
      [10, "Solid", "Revision is becoming a habit."],
      [15, "Locked In", "You and the timer are friends now."],
      [20, "Moving Up", "Momentum has entered the chat."],
      [25, "Desk Resident", "The chair knows your name."],
      [30, "Brain Builder", "Neuron gym membership active."],
      [40, "Focus Furnace", "Burning through distractions."],
      [50, "Half Century", "Fifty hours. Very real student lore."],
      [75, "Revision Royalty", "Crowned by flashcards."],
      [100, "A hunned!", "Triple digits. Respectfully huge."],
      [200, "Seconds, Minutes, Hours, Days, Weeks ...", "Time has become study-flavoured."],
      [300, "Calendar Conqueror", "The planner fears you."],
      [400, "Exam Ready", "Past papers are trembling."],
      [500, "Syllabus Slayer", "No topic left unbothered."],
      [600, "Library Legend", "A quiet academic celebrity."],
      [700, "Brain Marathoner", "Endurance studying unlocked."],
      [800, "Deep Work Diplomat", "Negotiated peace with procrastination."],
      [900, "Mastermind", "The whiteboard salutes."],
      [1000, "Millennium Scholar", "One thousand hours. Absurdly powerful."],
      [2000, "Study Behemoth", "Please hydrate."],
      [3000, "Touch Poaceae", "A grass-adjacent reminder."],
      [4000, "Time is relative...", "Einstein would check your screen time."],
      [5000, "PhD of all trades", "Basically an academic final boss."],
      [10000, "You're starting to look like your professor...?", "Ten thousand hours. Office hours are now your natural habitat."],
    ],
  },
  {
    key: "studyPeriods",
    label: "Study periods",
    unit: "periods",
    milestones: [
      [1, "First Bell", "One session down."],
      [5, "Timer Tamer", "Pomodoro has been domesticated."],
      [10, "Session Gobbler", "Focus blocks keep disappearing."],
      [25, "Interval Idol", "Tiny starts, massive stack."],
      [50, "Pomodoro Professor", "Teaching the timer manners."],
      [100, "Century Sitter", "One hundred focus sits."],
      [250, "Break Negotiator", "A master of work/rest diplomacy."],
      [500, "Clock Commander", "Time obeys, mostly."],
    ],
  },
  {
    key: "tasksMade",
    label: "Tasks made",
    unit: "tasks",
    milestones: [
      [1, "List Rookie", "A task has entered reality."],
      [5, "Checklist Chef", "Cooking up productivity."],
      [10, "Task Wrangler", "The list is under control."],
      [25, "Deadline Dentist", "Pulling out overdue problems."],
      [50, "Plan Goblin CEO", "Legally distinct planning energy."],
      [100, "To-Do Titan", "The checklist fears deletion."],
      [250, "Admin Wizard", "Forms simply cannot survive."],
    ],
  },
  {
    key: "longestStreak",
    label: "Longest streak",
    unit: "days",
    milestones: [
      [2, "Two-Day Tango", "You came back."],
      [3, "Hat Trick", "Three days, no vanishing."],
      [7, "Week Warrior", "A full week of study wins."],
      [14, "Fortnight Flame", "Two weeks lit."],
      [30, "Monthly Menace", "A calendar page conquered."],
      [60, "Routine Royalty", "Habit throne secured."],
      [100, "Streak Supreme", "Three digits of consistency."],
      [365, "Yearlong Legend", "A whole year. Ridiculous."],
    ],
  },
  {
    key: "levels",
    label: "Levels",
    unit: "levels",
    milestones: [
      [2, "XP, Finally", "The bar moved. This is how it begins."],
      [5, "Study Nugget", "Small, shiny, academically suspicious."],
      [10, "Brain Buff", "The brain gains are visible from orbit."],
      [15, "Book Gobbler", "Pages enter. Knowledge happens."],
      [20, "Focus Gremlin", "Focus mode has become a personality trait."],
      [30, "Desk Mode", "Chair locked. Notes loaded."],
      [40, "No Thoughts, Notes", "Head empty, notebook full."],
      [50, "Half Nerd", "Not full nerd yet. Getting there."],
      [75, "Syllabus Slayer Jr.", "The syllabus has been lightly threatened."],
      [100, "Study or Be Studied", "The flashcards are no longer in charge."],
      [150, "Revise and Conquer", "You revised, therefore you conquered."],
      [200, "Crammed Knowledge", "Packed tighter than a final-week timetable."],
      [300, "Predator and Preyper", "A study-chain apex moment."],
      [400, "Eat, Sleep, Annotate", "The routine is deeply annotated."],
      [500, "Overprepared", "You brought backup notes for your backup notes."],
      [600, "No Pain, No Brain", "The neurons have filed a complaint."],
      [700, "Flashcard Final Boss", "Even the hard deck is nervous."],
      [800, "Marked for Greatness", "Red pen energy, but make it heroic."],
      [900, "Grade Goblin", "The rubric fears your arrival."],
      [1000, "The Professor", "Office hours are now your natural habitat."],
    ],
  },
  {
    key: "specialBadges",
    label: "Special badges",
    unit: "badges",
    special: true,
    milestones: [
      ["staff", "Staff", "Official Postcrastination team member.", "Legendary"],
      ["premium", "Premium Member", "Supporting the platform with premium access.", "Mythical"],
      ["moderator", "Moderator", "Trusted community helper and peacekeeper.", "Celestial"],
      ["founder", "Founder", "Early legend from the beginning of Postcrastination.", "Transcendent"],
      ["verifiedTutor", "Verified Tutor", "Approved to help students learn smarter.", "Epic"],
    ],
  },
];

const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Mythical", "Legendary", "Celestial", "Transcendent"];
const rarityStyles = {
  Common: "border-white/20 bg-white/10 text-white",
  Uncommon: "border-emerald-300/35 bg-emerald-400/15 text-emerald-100",
  Rare: "border-sky-300/35 bg-sky-400/15 text-sky-100",
  Epic: "border-purple-300/40 bg-purple-400/18 text-purple-100",
  Mythical: "border-orange-300/45 bg-orange-400/18 text-orange-100",
  Legendary: "border-red-300/40 bg-gradient-to-r from-red-500/20 to-yellow-300/20 text-yellow-100",
  Celestial: "border-cyan-200/45 bg-gradient-to-r from-cyan-300/18 to-purple-400/18 text-cyan-50",
  Transcendent: "border-white/60 bg-gradient-to-r from-white/25 via-purple-300/25 to-yellow-300/25 text-white",
};

function getRarityForMilestone(groupKey, threshold, index, total, explicitRarity) {
  if (explicitRarity) return explicitRarity;
  if (groupKey === "studyMinutes" && threshold >= 10000) return "Transcendent";
  const rarityIndex = Math.min(rarityOrder.length - 1, Math.floor((index / Math.max(1, total - 1)) * rarityOrder.length));
  return rarityOrder[rarityIndex];
}

function flattenAchievements() {
  return achievementGroups.flatMap((group) =>
    group.milestones.map((milestone, index) => {
      if (group.special) {
        const [badgeKey, name, description, rarity] = milestone;
        return {
          id: `${group.key}:${badgeKey}`,
          groupKey: group.key,
          groupLabel: group.label,
          unit: group.unit,
          threshold: 1,
          requirement: "Granted by an admin or included with a paid/special role.",
          name,
          description,
          rarity,
          special: true,
          badgeKey,
        };
      }

      const [threshold, name, description, explicitRarity] = milestone;
      return {
        id: `${group.key}:${threshold}`,
        groupKey: group.key,
        groupLabel: group.label,
        unit: group.unit,
        threshold,
        requirement: `Reach ${threshold} ${group.unit}.`,
        name,
        description,
        rarity: getRarityForMilestone(group.key, threshold, index, group.milestones.length, explicitRarity),
      };
    })
  );
}

const allAchievements = flattenAchievements();

function readLocalCache(key, fallbackValue) {
  if (typeof window === "undefined" || !window.localStorage) return fallbackValue;

  try {
    const cached = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return cached ? JSON.parse(cached) : fallbackValue;
  } catch (error) {
    console.warn(`Could not read local cache for ${key}.`, error);
    return fallbackValue;
  }
}

function writeLocalCache(key, value) {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not write local cache for ${key}.`, error);
  }
}

function useLocalCacheState(key, fallbackValue) {
  const [value, setValue] = useState(() => readLocalCache(key, fallbackValue));

  useEffect(() => {
    writeLocalCache(key, value);
  }, [key, value]);

  return [value, setValue];
}

function normalizeUsername(username) {
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function buildDisplayName(profile) {
  return [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" ").trim();
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getLevelThreshold(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (safeLevel <= 1) return 0;
  return 10 * Math.round((100 + 28 * (safeLevel - 2) + 45 * (1.12 ** (safeLevel - 2) - 1)) / 10);
}

function getLevelProgress(xpTotal) {
  const xp = Math.max(0, Math.floor(Number(xpTotal) || 0));
  let level = 1;

  while (level < 10000 && xp >= getLevelThreshold(level + 1)) {
    level += 1;
  }

  const currentThreshold = getLevelThreshold(level);
  const nextThreshold = getLevelThreshold(level + 1);
  const neededForNext = Math.max(1, nextThreshold - currentThreshold);
  const earnedThisLevel = Math.max(0, xp - currentThreshold);

  return {
    level,
    xp,
    currentThreshold,
    nextThreshold,
    earnedThisLevel,
    neededForNext,
    remaining: Math.max(0, nextThreshold - xp),
    percent: Math.min(100, Math.max(0, (earnedThisLevel / neededForNext) * 100)),
  };
}

function getTrimmedAverage(values) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  if (sorted.length < 4) return sorted.reduce((sum, value) => sum + value, 0) / sorted.length;

  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const low = q1 - iqr * 1.5;
  const high = q3 + iqr * 1.5;
  const filtered = sorted.filter((value) => value >= low && value <= high);
  const usable = filtered.length ? filtered : sorted;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function previousDayKey(dayKey) {
  const date = new Date(`${dayKey}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}

function isWeekendKey(dayKey) {
  const day = new Date(`${dayKey}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function calculateStudyStreak(log, weekendsCount = true) {
  const studiedDays = new Set(Object.keys(log || {}).filter((key) => log[key]?.completed));
  let cursor = todayKey();
  let current = 0;

  while (true) {
    if (!weekendsCount && isWeekendKey(cursor)) {
      cursor = previousDayKey(cursor);
      continue;
    }
    if (!studiedDays.has(cursor)) break;
    current += 1;
    cursor = previousDayKey(cursor);
  }

  let longest = 0;
  let run = 0;
  Object.keys(log || {})
    .sort()
    .forEach((key) => {
      if (!weekendsCount && isWeekendKey(key)) return;
      if (log[key]?.completed) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
    });

  return { current, longest };
}

function formatStudyTime(minutes) {
  const hours = Math.floor((Number(minutes) || 0) / 60);
  const mins = (Number(minutes) || 0) % 60;
  return `${hours}h ${mins}m`;
}

function getAchievementValue(stats, groupKey) {
  if (groupKey === "studyMinutes") return Math.floor((Number(stats.completedFocusMinutes) || 0) / 60);
  if (groupKey === "studyPeriods") return Number(stats.studyPeriods || 0);
  if (groupKey === "tasksMade") return Number(stats.tasksMade || 0);
  if (groupKey === "longestStreak") return Number(stats.longestStreak || 0);
  if (groupKey === "levels") return getLevelProgress(stats.xpTotal).level;
  if (groupKey === "specialBadges") return stats.specialBadges?.length || 0;
  return 0;
}

function getUnlockedAchievements(stats) {
  return allAchievements.filter((achievement) =>
    achievement.special
      ? (stats.specialBadges || []).includes(achievement.id)
      : getAchievementValue(stats, achievement.groupKey) >= achievement.threshold
  );
}

function getTopAchievements(stats) {
  return achievementGroups
    .map((group) => allAchievements.filter((achievement) => achievement.groupKey === group.key && getUnlockedAchievements(stats).some((unlocked) => unlocked.id === achievement.id)).at(-1))
    .filter(Boolean);
}

function getAchievementAudience(achievement, totalUsers) {
  const rarityRates = {
    Common: 0.72,
    Uncommon: 0.46,
    Rare: 0.25,
    Epic: 0.12,
    Mythical: 0.055,
    Legendary: 0.022,
    Celestial: 0.009,
    Transcendent: 0.003,
  };
  const users = Math.max(1, Number(totalUsers) || 1);
  const rate = rarityRates[achievement?.rarity] || 0.2;
  const holders = Math.min(users, Math.max(achievement?.rarity === "Transcendent" ? 1 : 0, Math.round(users * rate)));
  return {
    holders,
    percent: Math.min(100, Math.max(0, (holders / users) * 100)),
  };
}

function formatRelativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;
  return `${Math.floor(diff / week)}w ago`;
}

function getFriendlyAuthError(error) {
  const code = error?.code || "";
  const rawMessage = error?.message || "";
  const lowerMessage = rawMessage.toLowerCase();
  const messages = {
    "auth/email-already-in-use": "That email is already used by another account.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/user-not-found": "No account was found with those details.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/unauthorized-domain": "Firebase has not allowed this app address yet. Add the hostname you are using (localhost or 127.0.0.1) in Firebase Authentication settings under Authorized domains.",
    "auth/operation-not-allowed": "This sign-in method is disabled. Enable it in Firebase Authentication under Sign-in method.",
    "auth/invalid-api-key": "The Firebase API key is invalid. Check the web app configuration and restart Postcrastination.",
    "auth/configuration-not-found": "Firebase Authentication is not set up for this project yet. Open Authentication in the Firebase console and get started.",
    "auth/network-request-failed": "Sign-in could not reach Firebase. Check your connection and try again.",
    "auth/popup-closed-by-user": "The sign-in popup was closed before it finished.",
    "auth/popup-blocked": "The sign-in popup was blocked. Allow popups for this app and try again.",
    "auth/weak-password": "Password needs to be at least 6 characters.",
    "auth/account-exists-with-different-credential": "This email already uses a different sign-in method.",
    unavailable: "Firebase profile storage is offline. Email login can still work.",
    "permission-denied": "Firestore permissions blocked this profile action.",
  };

  if (lowerMessage.includes("client is offline") || lowerMessage.includes("failed to get document")) {
    return "Firestore is offline right now. Try email login, check your internet, or enable Firestore in Firebase.";
  }

  return messages[code] || error?.message || "Authentication failed.";
}

async function resolveEmailOrUsername(identifier) {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return trimmed;
  if (!db) throw new Error("Please sign in with your email address. Username sign-in is not connected yet.");

  try {
    const usernameKey = normalizeUsername(trimmed);
    const usernameSnapshot = await getDoc(doc(db, "usernames", usernameKey));
    const uid = usernameSnapshot.data()?.uid;
    if (!uid) throw new Error("No account found for that username.");

    const userSnapshot = await getDoc(doc(db, "users", uid));
    const email = userSnapshot.data()?.email;
    if (!email) throw new Error("That username does not have an email login.");

    return email;
  } catch (error) {
    if (error?.message?.startsWith("No account") || error?.message?.startsWith("That username")) {
      throw error;
    }
    throw new Error("Username login needs Firestore. Try signing in with your email address instead.");
  }
}

function withTimeout(promise, milliseconds, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]);
}

async function assertUsernameAvailable(username) {
  if (!db) return;
  const usernameKey = normalizeUsername(username);
  try {
    const usernameDoc = await withTimeout(
      getDoc(doc(db, "usernames", usernameKey)),
      4500,
      "Could not check username right now. Check your internet/Firestore and try again."
    );
    if (usernameDoc.exists()) throw new Error("That username is already taken.");
  } catch (error) {
    if (error?.message === "That username is already taken.") throw error;
    throw new Error("Could not check that username yet. Make sure Firestore is enabled and online, then try again.");
  }
}

async function reserveUsernameAndProfile(user, profile) {
  if (!db) { writeLocalCache(`pendingProfile:${user.uid}`, profile); return; }
  const usernameKey = normalizeUsername(profile.username);
  const userRef = doc(db, "users", user.uid);
  const usernameRef = doc(db, "usernames", usernameKey);
  const counterRef = doc(db, "metadata", "userCounter");

  await runTransaction(db, async (transaction) => {
    const usernameDoc = await transaction.get(usernameRef);
    const counterDoc = await transaction.get(counterRef);
    const nextUserId = Number(counterDoc.data()?.nextId || 2);

    if (usernameDoc.exists() && usernameDoc.data()?.uid !== user.uid) {
      throw new Error("That username is already taken.");
    }

    transaction.set(usernameRef, {
      uid: user.uid,
      username: profile.username.trim(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(counterRef, { nextId: nextUserId + 1 }, { merge: true });
    transaction.set(userRef, {
      uid: user.uid,
      userId: nextUserId,
      username: profile.username.trim(),
      usernameKey,
      firstName: profile.firstName.trim(),
      middleName: profile.middleName.trim(),
      lastName: profile.lastName.trim(),
      displayName: buildDisplayName(profile),
      email: user.email,
      photoURL: profile.photoURL || user.photoURL || "",
      studyLocation: profile.studyLocation?.trim() || "",
      profileVisibility: "public",
      weekendsCount: true,
      totalStudyMinutes: 0,
      currentStreak: 0,
      longestStreak: 0,
      authProvider: profile.authProvider || "password",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  });
}

async function ensureOAuthProfile(user, providerName) {
  if (!user) return;

  const emailName = user.email?.split("@")[0] || "student";
  const baseName = normalizeUsername(user.displayName || emailName) || "student";
  const username = user.displayName?.trim() || baseName;
  const nameParts = (user.displayName || "").split(" ").filter(Boolean);
  const firstName = nameParts[0] || "Student";
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "Account";
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
  const profile = {
    uid: user.uid,
    userId: "pending",
    username,
    firstName,
    middleName,
    lastName,
    studyLocation: "",
    email: user.email,
    photoURL: user.photoURL || "",
    profileVisibility: "public",
    weekendsCount: true,
    totalStudyMinutes: 0,
    currentStreak: 0,
    longestStreak: 0,
    authProvider: providerName,
  };

  if (!db) {
    if (!readLocalCache(`pendingProfile:${user.uid}`, null)) writeLocalCache(`pendingProfile:${user.uid}`, profile);
    return;
  }
  try {
    const userRef = doc(db, "users", user.uid);
    const existingProfile = await getDoc(userRef);
    if (existingProfile.exists()) return;
    await reserveUsernameAndProfile(user, profile);
  } catch (error) {
    console.warn("OAuth worked, but Firebase profile save failed.", error);
    writeLocalCache(`pendingProfile:${user.uid}`, profile);
  }
}

function useUserProfile(currentUser, devBypass = false) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (devBypass) {
        setProfile({
          ...ALEXANDER_PROFILE,
          uid: "dev-bypass-alexander",
          totalStudyMinutes: Math.max(ALEXANDER_PROFILE.totalStudyMinutes, readLocalCache("completedFocusMinutes", 0)),
        });
        return;
      }

      if (!currentUser) { setProfile(null); setLoading(false); return; }
      if (!db) {
        setProfile(readLocalCache(`pendingProfile:${currentUser.uid}`, null) || {
          uid: currentUser.uid, username: currentUser.displayName || 'Student',
          email: currentUser.email, photoURL: currentUser.photoURL || '',
          firstName: currentUser.displayName || 'Student', lastName: '',
          profileVisibility: 'private', weekendsCount: true,
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.uid));
        if (!cancelled) {
          setProfile(snapshot.exists() ? snapshot.data() : readLocalCache(`pendingProfile:${currentUser.uid}`, null));
          setLoading(false);
        }
      } catch (error) {
        console.warn("Could not load Firebase profile.", error);
        if (!cancelled) {
          const pending = readLocalCache(`pendingProfile:${currentUser.uid}`, null);
          setProfile(pending);
          setLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser, devBypass]);

  return { profile, setProfile, loading };
}

function runSelfTests() {
  const feb2024 = getMonthCalendarCells(2024, 1).filter(Boolean);
  console.assert(feb2024.length === 29, "February 2024 should have 29 visible days.");

  const april2026 = getMonthCalendarCells(2026, 3).filter(Boolean);
  const june2026 = getMonthCalendarCells(2026, 5).filter(Boolean);
  console.assert(april2026.length === 30, "Calendar should support months before the current month.");
  console.assert(june2026.length === 30, "Calendar should support months after the current month.");

  const week = getCurrentWeek(new Date(2026, 4, 13));
  console.assert(week.length === 7, "Current week should always contain 7 days.");
  console.assert(week[0].date.getDay() === 1, "Current week should start on Monday.");

  const sorted = sortTasksByDueDate([
    { name: "No date", dueDate: "" },
    { name: "Later", dueDate: "2026-05-20" },
    { name: "Sooner", dueDate: "2026-05-10" },
  ]);
  console.assert(sorted[0].name === "Sooner", "Tasks should sort from earliest date to latest date.");
  console.assert(sorted[2].name === "No date", "Tasks without dates should appear last.");

  const updated = updateThemeColor(defaultTheme, "orange", "#ffaa00");
  console.assert(updated.colors.orange === "#ffaa00", "Theme colour update should change the selected colour.");
  console.assert(defaultTheme.colors.orange === "#ff8a1f", "Theme colour update should not mutate the original theme.");

  const cacheKey = "self-test";
  writeLocalCache(cacheKey, { saved: true });
  const cached = readLocalCache(cacheKey, { saved: false });
  console.assert(cached.saved === true, "Local cache should save and read JSON values.");
}

const GlassPanel = memo(function GlassPanel({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-[2rem] border border-white/15 bg-white/[0.075] shadow-xl backdrop-blur-lg",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/12 before:to-transparent",
        "relative overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
});

const GlassButton = memo(function GlassButton({ children, className = "", onClick, title, disabled = false, type = "button", ...buttonProps }) {
  return (
    <button
      {...buttonProps}
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-md backdrop-blur-md transition-colors hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
});

const AppBackground = memo(function AppBackground({ theme }) {
  const style = useMemo(
    () =>
      theme.backgroundImage && theme.palette !== "contrast"
        ? {
            backgroundImage: `linear-gradient(color-mix(in srgb, var(--pc-base) 35%, transparent), color-mix(in srgb, var(--pc-base) 55%, transparent)), url(${theme.backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : !theme.glassEnabled ? { background: "var(--pc-base)" } : {
            background: `
              radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--pc-orange) 34%, transparent) 0, transparent 30%),
              radial-gradient(circle at 82% 20%, color-mix(in srgb, var(--pc-purple) 40%, transparent) 0, transparent 34%),
              radial-gradient(circle at 55% 88%, color-mix(in srgb, var(--pc-orange) 20%, transparent) 0, transparent 32%),
              linear-gradient(135deg, var(--pc-base), var(--pc-surface) 55%, var(--pc-base))
            `,
          },
    [theme]
  );

  return <div className="pointer-events-none fixed inset-0 z-0 transform-gpu" style={style} />;
});

function PageDots({ page, setPage }) {
  return (
    <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3">
      {[0, 1, 2].map((dot) => (
        <button
          key={dot}
          onClick={() => setPage(dot)}
          className={cx(
            "h-3 w-3 rounded-full border border-white/70 transition-all",
            page === dot ? "scale-110 bg-white" : "bg-transparent hover:bg-white/30"
          )}
          aria-label={`Go to page ${dot + 1}`}
        />
      ))}
    </div>
  );
}

function AppChrome({ theme, page, setPage, settingsOpen, onSettingsToggle }) {
  return (
    <>
      <div className="pointer-events-none absolute left-8 top-31 z-30">
        <div className="text-xs uppercase tracking-[0.28em] text-white/55">student focus system</div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-white drop-shadow">{theme.appName}</h1>
      </div>

      <button
        onClick={onSettingsToggle}
        className="absolute right-8 top-33 z-40 rounded-2xl border border-white/15 bg-white/10 p-2.5 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
        aria-label="Open settings"
      >
        <Icon name="settings" size={20} />
      </button>

      <button
        onClick={() => setPage(Math.max(0, page - 1))}
        disabled={page === 0}
        className="absolute left-5 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/15 bg-white/10 p-3 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-25"
        aria-label="Previous page"
      >
        <Icon name="chevronLeft" />
      </button>

      <button
        onClick={() => setPage(Math.min(2, page + 1))}
        disabled={page === 2}
        className="absolute right-5 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/15 bg-white/10 p-3 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-25"
        aria-label="Next page"
      >
        <Icon name="chevronRight" />
      </button>
    </>
  );
}

function SettingsPopover({ customizeOpen, setCustomizeOpen, moduleEditOpen, setModuleEditOpen, setSettingsOpen }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      className="absolute right-8 top-40 z-40 w-72 rounded-3xl border border-white/15 bg-black/50 p-4 text-white shadow-xl backdrop-blur-lg"
    >
      <button
        onClick={() => {
          setCustomizeOpen(!customizeOpen);
          setModuleEditOpen(false);
        }}
        className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left hover:bg-white/15"
      >
        <span className="font-semibold">Customise</span>
        <Icon name="sliders" size={18} />
      </button>
      <button
        onClick={() => {
          setModuleEditOpen(!moduleEditOpen);
          setCustomizeOpen(false);
          setSettingsOpen(false);
        }}
        className="mt-2 flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left hover:bg-white/15"
      >
        <span className="font-semibold">Edit Modules</span>
        <Icon name="plus" size={18} />
      </button>
      <div className="mt-3 space-y-2 text-sm text-white/65">
        <div className="rounded-2xl bg-white/[0.06] px-4 py-3">Account settings — later</div>
        <div className="rounded-2xl bg-white/[0.06] px-4 py-3">Notifications — later</div>
        <div className="rounded-2xl bg-white/[0.06] px-4 py-3">Export data — later</div>
      </div>
    </motion.div>
  );
}

function CustomizeDrawer({ theme, setTheme }) {
  const updateColor = (key, value) => {
    setTheme((prev) => ({ ...updateThemeColor(prev, key, value), mode: "custom" }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      role="dialog" aria-label="Appearance settings" className="appearance-drawer fixed bottom-24 right-4 top-44 z-40 w-[min(360px,calc(100vw-2rem))] overflow-auto rounded-[2rem] border border-white/15 bg-black/55 p-4 text-white shadow-xl backdrop-blur-lg"
    >
      <h2 className="text-xl font-bold">Customise workspace</h2>
      <p className="mt-1 text-sm text-white/60">Choose a simple theme or make it your own.</p>
      <fieldset className="mt-5"><legend className="text-sm font-semibold">Colour theme</legend><div className="mt-3 grid grid-cols-2 gap-2">
        {[["light","Light"],["dark","Dark"],["system","Follow device"],["contrast","High contrast"],["custom","Custom"]].map(([mode,label]) => <button key={mode} type="button" aria-pressed={(theme.mode || "light") === mode} className="theme-choice workspace-secondary" onClick={() => setTheme(prev => ({ ...prev, mode }))}>{label}</button>)}
      </div></fieldset>
      <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-white/15 p-3"><span><span className="block text-sm font-semibold">Glass effects</span><span className="mt-1 block text-xs text-white/60">Blur, transparency and a gradient background</span></span><input type="checkbox" role="switch" aria-label="Glass effects" disabled={theme.mode === "contrast"} checked={theme.mode === "contrast" ? false : (theme.glassEnabled ?? false)} onChange={event => setTheme(prev => ({ ...prev, glassEnabled: event.target.checked }))} className="h-5 w-5 shrink-0" /></label>
      <fieldset className="mt-5 space-y-4 rounded-2xl border border-white/15 p-3"><legend className="px-1 text-sm font-bold">Accessibility &amp; reading</legend>
        <label className="block text-sm">Text size<select aria-label="Text size" className="mt-2 w-full rounded-xl border border-white/15 p-3" value={theme.textScale || "100"} onChange={event => setTheme(prev => ({ ...prev, textScale: event.target.value }))}>{[["100","Standard"],["112","Large"],["125","Larger"],["150","Extra large"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {[["readingSpace","More reading space","Increases line height, letter spacing and word spacing."],["largeControls","Larger controls","Makes buttons and form fields easier to select."],["reduceMotion","Reduce motion","Stops decorative movement and transitions."]].map(([key,label,hint]) => <label key={key} className="flex items-center justify-between gap-3"><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-white/60">{hint}</span></span><input type="checkbox" role="switch" aria-label={label} checked={Boolean(theme[key])} onChange={event => setTheme(prev => ({ ...prev, [key]: event.target.checked }))} className="h-5 w-5 shrink-0" /></label>)}
        <p className="text-xs text-white/60">High contrast always uses solid backgrounds. Your device’s reduced-motion preference is respected too.</p>
      </fieldset>
      <p className="mt-4 text-xs text-white/60">Custom colours and wallpaper are kept when you switch themes. Editing a colour selects Custom.</p>

      <div className="mt-5 space-y-4">
        {[
          ["base", "Background"],
          ["surface", "Card background"],
          ["text", "Text"],
          ["muted", "Secondary text"],
          ["orange", "Orange accent"],
          ["purple", "Purple accent"],
        ].map(([key, label]) => (
          <label key={key} className="block rounded-2xl bg-white/[0.06] p-3">
            <span className="text-sm text-white/70">{label}</span>
            <div className="mt-2 flex gap-2">
              <input
                value={theme.colors?.[key] || defaultTheme.colors[key]}
                onChange={(e) => updateColor(key, e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                placeholder="#ff8a1f or colour name"
              />
              <input
                type="color"
                value={(theme.colors?.[key] || "").startsWith("#") ? theme.colors[key] : "#ffffff"}
                onChange={(e) => updateColor(key, e.target.value)}
                className="h-10 w-12 rounded-xl border border-white/10 bg-transparent"
              />
            </div>
          </label>
        ))}

        <label className="block rounded-2xl bg-white/[0.06] p-3">
          <span className="flex items-center gap-2 text-sm text-white/70">
            <Icon name="image" size={16} /> Wallpaper image URL
          </span>
          <input
            value={theme.backgroundImage}
            onChange={(e) => setTheme((prev) => ({ ...prev, backgroundImage: e.target.value }))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            placeholder="Paste image URL here"
          />
        </label>

        <div className="rounded-2xl bg-white/[0.06] p-3">
          <div className="text-sm font-semibold">Central page widgets</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {widgetCatalog.map((widget) => (
              <div key={widget.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs font-semibold">{widget.name}</div>
                <div className="mt-1 text-[11px] text-white/50">Default: {widget.defaultSize}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ModulesAddBar({ modules, setModules }) {
  const [open, setOpen] = useState(false);
  const [message,setMessage]=useState('');
  const activeIds = modules.map((module) => module.id);
  const addModule = (id) => {
    const result=planModulePlacement(id,modules,widgetCatalog);
    setMessage(result.ok?result.message:result.reason);
    if(result.ok)setModules(current=>{const check=planModulePlacement(id,current,widgetCatalog);return check.ok?[...current,check.module]:current;});
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.96 }}
      className="fixed bottom-8 right-8 z-50 text-white"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="mb-3 w-[min(360px,calc(100vw-100px))] rounded-[1.5rem] border border-white/15 bg-black/60 p-3 shadow-xl backdrop-blur-lg"
          >
            <p id="module-placement-feedback" role="status" aria-live="polite" className="mb-3 text-sm">{message||'Preset size is tried first. Modules can shrink to a minimum of 3 × 3.'}</p>
            <div className="grid grid-cols-2 gap-2">
              {widgetCatalog.map((widget) => (
                <button
                  key={widget.id}
                  type="button"
                  aria-describedby="module-placement-feedback"
                  onClick={() => addModule(widget.id)}
                  className="rounded-xl border border-white/10 bg-white/[0.06] p-3 text-left text-xs transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <div className="font-semibold">{widget.name}</div>
                  <div className="mt-1 text-[11px] text-white/50">{activeIds.includes(widget.id)?"Already on your board":"Preset: "+widget.defaultSize}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        onClick={() => setOpen(open ? "" : "notifications")}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="ml-auto flex rounded-full border border-white/60 bg-gradient-to-br from-white via-purple-300 to-yellow-300 px-5 py-3 text-sm font-black text-zinc-950 shadow-xl"
      >
        {open ? "Close Modules" : "Add Modules"}
      </motion.button>
    </motion.div>
  );
}

function DatePickerPopup({ selectedDate, setSelectedDate, onClose }) {
  const parsed = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
  const initialDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const cells = getMonthCalendarCells(year, month);

  const moveMonth = (amount) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const pickDay = (day) => {
    if (!day) return;
    const date = new Date(year, month, day);
    setSelectedDate(toISODateLocal(date));
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      className="absolute left-1/2 top-[3.35rem] z-50 w-[360px] -translate-x-1/2 rounded-3xl border border-white/15 bg-black/70 p-5 shadow-2xl backdrop-blur-2xl"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/20"
          aria-label="Previous month"
        >
          <Icon name="chevronLeft" size={17} />
        </button>
        <div className="text-center">
          <div className="text-base font-bold">
            {visibleMonth.toLocaleString("en", { month: "long" })}
          </div>
          <div className="text-xs text-white/45">{year}</div>
        </div>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/20"
          aria-label="Next month"
        >
          <Icon name="chevronRight" size={17} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, index) => (
          <div key={`${d}-${index}`} className="py-1">{d}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((day, index) => {
          const iso = day ? toISODateLocal(new Date(year, month, day)) : "";
          return (
            <button
              key={index}
              type="button"
              onClick={() => pickDay(day)}
              className={cx(
                "flex h-10 w-10 items-center justify-center rounded-2xl text-sm transition",
                day ? "bg-white/[0.07] text-white hover:bg-white/20" : "pointer-events-none text-transparent",
                selectedDate && day && selectedDate === iso && "bg-orange-400/85 font-bold text-white shadow-lg shadow-orange-500/20"
              )}
            >
              {day || "•"}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function TaskCreator({ tasks, setTasks, onTaskCreated }) {
  const emptyDraft = { name: "", urgency: "Medium", dueDate: "", labels: "" };
  const [draftTask, setDraftTask] = useState(emptyDraft);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const updateDraft = (key, value) => {
    setDraftTask((current) => ({ ...current, [key]: value }));
  };

  const addTask = () => {
    if (!draftTask.name.trim()) return;
    setTasks((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: draftTask.name.trim(),
        urgency: draftTask.urgency,
        dueDate: draftTask.dueDate,
        labels: draftTask.labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean),
      },
    ]);
    onTaskCreated?.();
    setDraftTask(emptyDraft);
  };

  const handleDraftKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTask();
    }
  };

  return (
    <div className="relative space-y-3">
      <h2 className="text-xl font-bold">To Do List</h2>

      <div className="overflow-visible rounded-3xl border border-white/10 bg-black/20">
        <div className="task-form-head grid grid-cols-[1.5fr_0.8fr_1fr_1.2fr_44px] gap-2 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45">
          <div>Task</div>
          <div>Urgency</div>
          <div>Due date</div>
          <div>Labels</div>
          <div className="text-center">Add</div>
        </div>

        <div className="task-form-fields grid grid-cols-[1.5fr_0.8fr_1fr_1.2fr_44px] items-center gap-2 px-3 py-3">
          <input
            value={draftTask.name}
            onChange={(e) => updateDraft("name", e.target.value)}
            onKeyDown={handleDraftKeyDown}
            aria-label="Task name" placeholder="New task"
            className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/30"
          />
          <select
            aria-label="Urgency" value={draftTask.urgency}
            onChange={(e) => updateDraft("urgency", e.target.value)}
            onKeyDown={handleDraftKeyDown}
            className="min-w-0 rounded-2xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          >
            <option className="bg-zinc-950 text-white">Low</option>
            <option className="bg-zinc-950 text-white">Medium</option>
            <option className="bg-zinc-950 text-white">High</option>
            <option className="bg-zinc-950 text-white">Emergency</option>
          </select>
          <div className="relative min-w-0">
            <input
              aria-label="Due date" value={draftTask.dueDate}
              onChange={(e) => updateDraft("dueDate", e.target.value)}
              onFocus={() => setCalendarOpen(true)}
              onKeyDown={handleDraftKeyDown}
              placeholder="YYYY-MM-DD"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 pr-9 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={() => setCalendarOpen((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/55"
              aria-label="Open calendar"
            >
              <Icon name="calendar" size={16} />
            </button>
            <AnimatePresence>
              {calendarOpen && (
                <DatePickerPopup
                  selectedDate={draftTask.dueDate}
                  setSelectedDate={(value) => updateDraft("dueDate", value)}
                  onClose={() => setCalendarOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>
          <input
            value={draftTask.labels}
            onChange={(e) => updateDraft("labels", e.target.value)}
            onKeyDown={handleDraftKeyDown}
            aria-label="Labels" placeholder="Labels: Biology, admin"
            className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={addTask}
            disabled={!draftTask.name.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-orange-400/25 text-white transition hover:bg-orange-400/40 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Add task"
          >
            <Icon name="check" size={17} />
          </button>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        {tasks.map((task) => (
          <div key={task.id} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{task.name}</div>
                <div className="text-xs text-white/55">Due {task.dueDate || "not set"}</div>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70">{task.urgency}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <span key={label} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/55">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyCalendar({ tasks }) {
  const week = getCurrentWeek(new Date());

  return (
    <div className="mt-6 min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Current week</h3>
        <span className="text-xs text-white/40">Your task deadlines</span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="week-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {week.map(({ date, iso }) => {
            const due = tasks.filter((task) => task.dueDate === iso);
            return (
              <div key={iso} className="min-h-40 rounded-3xl border border-white/10 bg-white/[0.055] p-3 shadow-md backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
                    {date.toLocaleDateString("en", { weekday: "short" })}
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold">
                    {date.getDate()}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {due.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/30">
                      No tasks
                    </div>
                  ) : (
                    due.map((task) => (
                      <div key={task.id} className="rounded-2xl bg-orange-400/20 px-3 py-2 text-xs text-white/85">
                        <div className="line-clamp-2 font-medium">{task.name}</div>
                        <div className="mt-1 text-[10px] text-white/50">{task.urgency}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LeftPage({ tasks, setTasks, onTaskCreated }) {
  return (
    <GlassPanel className="h-full p-7 text-white">
      <div className="grid h-full grid-rows-[auto_1fr] gap-4 overflow-auto pr-1">
        <TaskCreator tasks={tasks} setTasks={setTasks} onTaskCreated={onTaskCreated} />
        <WeeklyCalendar tasks={tasks} />
      </div>
    </GlassPanel>
  );
}

function IntervalPopup({ work, setWork, rest, setRest, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-md"
    >
      <div className="w-[420px] rounded-[2rem] border border-white/15 bg-black/60 p-6 text-white shadow-2xl backdrop-blur-2xl">
        <h3 className="text-2xl font-bold">Choose intervals</h3>
        <p className="mt-1 text-sm text-white/60">Set work and break length in minutes.</p>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <label className="rounded-2xl bg-white/[0.06] p-4">
            <span className="text-sm text-white/60">Work</span>
            <input
              type="number"
              min="1"
              value={work}
              onChange={(e) => setWork(Math.max(1, Number(e.target.value) || 1))}
              className="mt-2 w-full rounded-xl bg-black/35 px-3 py-2 text-xl outline-none"
            />
          </label>
          <label className="rounded-2xl bg-white/[0.06] p-4">
            <span className="text-sm text-white/60">Break</span>
            <input
              type="number"
              min="1"
              value={rest}
              onChange={(e) => setRest(Math.max(1, Number(e.target.value) || 1))}
              className="mt-2 w-full rounded-xl bg-black/35 px-3 py-2 text-xl outline-none"
            />
          </label>
        </div>
        <GlassButton onClick={onClose} className="mt-5 w-full">Save intervals</GlassButton>
      </div>
    </motion.div>
  );
}

function PomodoroWidget({ controlId, setCompletedFocusMinutes, setStudyPeriods, onPomodoroComplete, getActivitySnapshot }) {
  const [work, setWork] = useLocalCacheState("pomodoroWorkMinutes", 25);
  const [rest, setRest] = useLocalCacheState("pomodoroRestMinutes", 5);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const blockRef = useRef({ startedAt: 0, interactions: 0 });

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (seconds === 0 && running) {
      setRunning(false);
      setCompletedFocusMinutes((current) => current + work);
      setStudyPeriods((current) => current + 1);
      onPomodoroComplete?.({
        workMinutes: work,
        restMinutes: rest,
        startedAt: blockRef.current.startedAt || Date.now(),
        startInteractions: blockRef.current.interactions || 0,
      });
    }
  }, [seconds, running, work, rest, setCompletedFocusMinutes, setStudyPeriods, onPomodoroComplete]);

  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");

  const reset = () => {
    setRunning(false);
    setSeconds(work * 60);
  };

  const toggleRunning = () => {
    setRunning((current) => {
      const next = !current;
      if (next) {
        const snapshot = getActivitySnapshot?.() || { interactions: 0 };
        blockRef.current = { startedAt: Date.now(), interactions: snapshot.interactions || 0 };
      }
      return next;
    });
  };

  const saveIntervals = () => {
    setIntervalOpen(false);
    setRunning(false);
    setSeconds(work * 60);
  };

  return (
    <div className="relative h-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Pomodoro</h3>
        <GlassButton onClick={() => setIntervalOpen(true)} className="px-3 py-1 text-xs">Intervals</GlassButton>
      </div>
      <div className="mt-4 text-center text-5xl font-black tracking-tight">{minutes}:{remainingSeconds}</div>
      <div className="mt-4 flex justify-center gap-3">
        <GlassButton id={controlId} aria-label={running ? "Pause focus timer" : "Start focus timer"} onClick={toggleRunning} className="h-10 w-10 rounded-full p-0">
          {running ? <Icon name="pause" size={18} /> : <Icon name="play" size={18} />}
        </GlassButton>
        <GlassButton aria-label="Reset focus timer" onClick={reset} className="h-10 w-10 rounded-full p-0">
          <Icon name="rotate" size={18} />
        </GlassButton>
      </div>
      <div className="mt-4 text-center text-xs text-white/50">Work {work} min · Break {rest} min</div>
      <AnimatePresence>
        {intervalOpen && <IntervalPopup work={work} setWork={setWork} rest={rest} setRest={setRest} onClose={saveIntervals} />}
      </AnimatePresence>
    </div>
  );
}

function GoalSettingsPopup({ targetHours, setTargetHours, targetMinutes, setTargetMinutes, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-md"
    >
      <div className="w-[520px] rounded-[2rem] border border-white/15 bg-black/65 p-6 text-white shadow-2xl backdrop-blur-2xl">
        <h3 className="text-2xl font-bold">Set goal target</h3>
        <p className="mt-1 text-sm text-white/60">Completed time updates automatically when a Pomodoro finishes.</p>

        <div className="mt-5">
          <div className="rounded-2xl bg-white/[0.06] p-4">
            <div className="mb-3 text-sm font-semibold text-white/70">Goal time</div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="text-xs text-white/45">Hours</span>
                <input
                  type="number"
                  min="0"
                  value={targetHours}
                  onChange={(e) => setTargetHours(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-xl bg-black/35 px-3 py-2 text-xl outline-none"
                />
              </label>
              <label>
                <span className="text-xs text-white/45">Minutes</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                  className="mt-1 w-full rounded-xl bg-black/35 px-3 py-2 text-xl outline-none"
                />
              </label>
            </div>
          </div>
        </div>

        <GlassButton onClick={onClose} className="mt-5 w-full">Save goal</GlassButton>
      </div>
    </motion.div>
  );
}

const GoalGauge = memo(function GoalGauge({ completedFocusMinutes }) {
  const [goal, setGoal] = useLocalCacheState("goalTitle", "Finish today’s revision");
  const [targetHours, setTargetHours] = useLocalCacheState("goalTargetHours", 3);
  const [targetMinutes, setTargetMinutes] = useLocalCacheState("goalTargetMinutes", 0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const targetTotalMinutes = targetHours * 60 + targetMinutes;
  const doneTotalMinutes = completedFocusMinutes;
  const doneHours = Math.floor(doneTotalMinutes / 60);
  const doneMinutes = doneTotalMinutes % 60;
  const progress = targetTotalMinutes > 0 ? Math.min(100, Math.round((doneTotalMinutes / targetTotalMinutes) * 100)) : 0;

  // SVG semicircle: 0% = left side, 50% = top, 100% = right side.
  // This avoids the previous CSS rotation problem where the needle could rotate underneath the dial.
  const needle = useMemo(() => {
    const angle = Math.PI - (progress / 100) * Math.PI;
    const radius = 88;
    const centerX = 120;
    const centerY = 112;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY - Math.sin(angle) * radius,
      centerX,
      centerY,
    };
  }, [progress]);

  const statusTone = progress < 35 ? "text-red-300" : progress < 70 ? "text-yellow-200" : "text-green-300";

  return (
    <div className="relative h-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 transform-gpu">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Goal completion</h3>
        <GlassButton onClick={() => setSettingsOpen(true)} className="px-3 py-1 text-xs">Set goal</GlassButton>
      </div>
      <input
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none"
      />

      <div className="mx-auto mt-1 flex justify-center">
        <svg width="220" height="110" viewBox="0 0 240 132" className="max-w-full overflow-visible transform-gpu">
          <defs>
            <linearGradient id="goalGaugeGradient" x1="20" x2="220" y1="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--pc-danger)" />
              <stop offset="28%" stopColor="var(--pc-orange)" />
              <stop offset="52%" stopColor="var(--pc-gold)" />
              <stop offset="74%" stopColor="var(--pc-warning)" />
              <stop offset="100%" stopColor="var(--pc-success)" />
            </linearGradient>
          </defs>
          <path
            d="M 28 112 A 92 92 0 0 1 212 112"
            fill="none"
            stroke="url(#goalGaugeGradient)"
            strokeWidth="28"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M 52 112 A 68 68 0 0 1 188 112"
            fill="none"
            stroke="color-mix(in srgb, var(--pc-base) 72%, transparent)"
            strokeWidth="42"
            strokeLinecap="round"
          />
          <motion.line
            x1={needle.centerX}
            y1={needle.centerY}
            x2={needle.x}
            y2={needle.y}
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            initial={false}
            animate={{ x2: needle.x, y2: needle.y }}
            transition={{ type: "spring", stiffness: 180, damping: 24 }}
          />
          <circle cx={needle.centerX} cy={needle.centerY} r="9" fill="white" />
        </svg>
      </div>

      <div className="-mt-1 text-center">
        <div className={cx("text-xl font-black", statusTone)}>{progress}%</div>
        <div className="text-[11px] text-white/55">
          {doneHours}h {doneMinutes}m completed from Pomodoros / {targetHours}h {targetMinutes}m goal
        </div>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <GoalSettingsPopup
            targetHours={targetHours}
            setTargetHours={setTargetHours}
            targetMinutes={targetMinutes}
            setTargetMinutes={setTargetMinutes}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

function OverviewWidget({ tasks }) {
  const sorted = sortTasksByDueDate(tasks);
  return (
    <div className="h-full min-h-0 rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Daily / weekly overview</h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">Upcoming</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {sorted.slice(0, 4).map((task) => (
          <div key={task.id} className="rounded-2xl bg-black/20 p-3">
            <div className="text-sm font-medium leading-snug">{task.name}</div>
            <div className="mt-1 text-xs text-white/55">{task.dueDate || "No date"} · {task.urgency}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIAssistantWidget({ setView }) {
  return (
    <div className="h-full min-h-0 rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 text-sm">
      <div className="flex items-center gap-2">
        <Icon name="bot" size={17} />
        <h3 className="text-sm font-bold">AI assistant</h3>
      </div>
      <div className="mt-4 rounded-2xl bg-black/25 p-4 text-xs leading-6 text-white/65">
        Turn your tasks into a study schedule with active recall, Pomodoro blocks, breaks, and sleep prep.
      </div>
      <GlassButton onClick={() => setView("planner")} className="mt-4 w-full px-3 py-2 text-xs">
        Open planner
      </GlassButton>
    </div>
  );
}

function MusicWidget() {
  const [volume, setVolume] = useLocalCacheState("musicVolume", 72);
  const fallbackTrack = {
    title: "No media playing",
    artist: "Start Spotify, YouTube, or another media app",
    duration: 0,
    album: "Waiting for Windows media",
    artwork: "",
    playbackStatus: "Idle",
    sourceAppId: "",
  };
  const [systemMedia, setSystemMedia] = useState(null);
  const track = systemMedia?.available
    ? {
        title: systemMedia.title || fallbackTrack.title,
        artist: systemMedia.artist || fallbackTrack.artist,
        duration: systemMedia.duration || fallbackTrack.duration,
        album: systemMedia.albumTitle || systemMedia.sourceAppId || fallbackTrack.album,
        artwork: systemMedia.artwork || "",
        playbackStatus: systemMedia.playbackStatus || "Unknown",
        sourceAppId: systemMedia.sourceAppId || "",
      }
    : fallbackTrack;
  const hasMedia = Boolean(systemMedia?.available && systemMedia.title && systemMedia.title !== "No media session");
  const displayedTime = hasMedia ? systemMedia.position || 0 : 0;
  const progress = track.duration > 0 ? Math.min(100, Math.round((displayedTime / track.duration) * 100)) : 0;

  useEffect(() => {
    let cancelled = false;

    const updateMedia = async () => {
      if (!window.postcrastinationMedia?.getCurrent) return;
      const media = await window.postcrastinationMedia.getCurrent();
      if (!cancelled) {
        setSystemMedia(media);
      }
    };

    updateMedia();
    const timer = window.setInterval(updateMedia, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="music" size={17} />
          <h3 className="text-sm font-bold">Music player</h3>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/55">{track.playbackStatus}</span>
      </div>

      <div className="mt-3 grid flex-1 grid-rows-[auto_auto_auto] gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-end overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500 via-zinc-950 to-orange-400 shadow-lg">
            {track.artwork ? (
              <img src={track.artwork} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="m-3 h-8 w-8 rounded-xl bg-white/20 backdrop-blur-md" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-bold">{track.title}</div>
            <div className="mt-1 truncate text-xs text-white/55">{track.artist}</div>
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/45">
              {track.album}
            </div>
            {systemMedia?.error && <div className="mt-2 text-[11px] text-red-200/75">{systemMedia.error}</div>}
          </div>
        </div>

        {hasMedia && (
          <div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-white/50">
              <span>{formatPlaybackTime(displayedTime)}</span>
              <span>{formatPlaybackTime(track.duration)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-orange-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {hasMedia && <div className="space-y-4">
          <div className="flex justify-center gap-2">
            <GlassButton className="h-9 w-9 rounded-full p-0"><Icon name="skipBack" size={15} /></GlassButton>
            <GlassButton className="h-9 w-9 rounded-full p-0"><Icon name="pause" size={15} /></GlassButton>
            <GlassButton className="h-9 w-9 rounded-full p-0"><Icon name="skipForward" size={15} /></GlassButton>
          </div>

          <label className="block rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="mb-2 flex items-center justify-between text-[11px] text-white/55">
              <span>Volume</span>
              <span>{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="h-2 w-full accent-purple-300"
              aria-label="Volume"
            />
          </label>
        </div>}
      </div>
    </div>
  );
}

function ModuleShell({ module, editMode, removeModule, updateModule, children }) {
  const safe = clampModule(module);
  const handleClass =
    "absolute z-20 h-5 w-5 cursor-nwse-resize rounded-full border border-white/70 bg-gradient-to-br from-white via-purple-300 to-yellow-300 shadow-lg transition duration-200 hover:scale-125";
  const startResize = (event, mode) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...safe };
    const cellW = event.currentTarget.closest("[data-grid-stage]")?.clientWidth / 12 || 80;
    const cellH = event.currentTarget.closest("[data-grid-stage]")?.clientHeight / 6 || 80;

    const onMove = (moveEvent) => {
      const dx = Math.round((moveEvent.clientX - startX) / cellW);
      const dy = Math.round((moveEvent.clientY - startY) / cellH);
      const next = { ...start };

      if (mode.includes("right")) next.w = start.w + dx;
      if (mode.includes("bottom")) next.h = start.h + dy;
      if (mode.includes("left")) {
        next.x = start.x + dx;
        next.w = start.w - dx;
      }
      if (mode.includes("top")) {
        next.y = start.y + dy;
        next.h = start.h - dy;
      }

      updateModule(module.id, next);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="group relative min-h-0"
      style={{
        gridColumn: `${safe.x} / span ${safe.w}`,
        gridRow: `${safe.y} / span ${safe.h}`,
      }}
    >
      <div className={cx("h-full min-h-0", editMode && "pointer-events-none opacity-80")}>{children}</div>
      {editMode && (
        <>
          <motion.button
            type="button"
            onClick={() => removeModule(module.id)}
            initial={false}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
            className="absolute right-2 top-2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/90 text-sm font-black text-white shadow-lg transition duration-200"
            aria-label={`Remove ${module.id}`}
          >
            x
          </motion.button>
          <button type="button" onPointerDown={(event) => startResize(event, "top-left")} className={cx(handleClass, "-left-2 -top-2 cursor-nwse-resize")} title="Drag to resize" />
          <button type="button" onPointerDown={(event) => startResize(event, "top-right")} className={cx(handleClass, "-right-2 -top-2 cursor-nesw-resize")} title="Drag to resize" />
          <button type="button" onPointerDown={(event) => startResize(event, "bottom-left")} className={cx(handleClass, "-bottom-2 -left-2 cursor-nesw-resize")} title="Drag to resize" />
          <button type="button" onPointerDown={(event) => startResize(event, "bottom-right")} className={cx(handleClass, "-bottom-2 -right-2 cursor-nwse-resize")} title="Drag to resize" />
        </>
      )}
    </motion.div>
  );
}

function CenterPage({ personalTaskPanel, tasks, setTasks, customizeOpen, moduleEditOpen, modules, setModules, setView, completedFocusMinutes, setCompletedFocusMinutes, setStudyPeriods, onTaskCreated, onPomodoroComplete, getActivitySnapshot }) {
  const removeModule = (id) => setModules((current) => current.filter((module) => module.id !== id));
  const updateModule = (id, patch) => {
    setModules((current) => {
      const original = current.find((module) => module.id === id);
      if (!original) return current;
      const next = clampModule({ ...original, ...patch });
      if (moduleCollides(next, current)) return current;
      return current.map((module) => (module.id === id ? next : module));
    });
  };
  const renderModule = (module) => {
    const props = {
      pomodoro: <PomodoroWidget controlId="today-focus-start" setCompletedFocusMinutes={setCompletedFocusMinutes} setStudyPeriods={setStudyPeriods} onPomodoroComplete={onPomodoroComplete} getActivitySnapshot={getActivitySnapshot} />,
      goal: <GoalGauge completedFocusMinutes={completedFocusMinutes} />,
      taskCreator: <div className="h-full overflow-auto rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 text-sm">{personalTaskPanel || <TaskCreator tasks={tasks} setTasks={setTasks} onTaskCreated={onTaskCreated} />}</div>,
      overview: <OverviewWidget tasks={tasks} />,
      ai: <AIAssistantWidget setView={setView} />,
      music: <MusicWidget />,
    };
    return props[module.id] || null;
  };

  return (
    <GlassPanel className="h-full p-4 text-white">
      <div className="relative h-full">
        {(customizeOpen || moduleEditOpen) && (
          <div className="pointer-events-none absolute inset-0 z-0 grid grid-cols-12 grid-rows-6 gap-2 opacity-35">
            {Array.from({ length: 72 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-dashed border-white/25" />
            ))}
          </div>
        )}

        <div data-grid-stage className="relative z-10 grid h-full grid-cols-12 grid-rows-6 gap-3">
          {modules.map((module) => (
            <ModuleShell key={module.id} module={module} editMode={moduleEditOpen} removeModule={removeModule} updateModule={updateModule}>
              {renderModule(module)}
            </ModuleShell>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

function RightPage() {
  return (
    <GlassPanel className="flex h-full items-center justify-center p-7 text-white">
      <div className="text-center">
        <div className="text-sm uppercase tracking-[0.45em] text-white/45">right card</div>
        <h2 className="mt-4 text-7xl font-black tracking-tight">WIP</h2>
        <p className="mt-4 max-w-md text-white/55">This page is reserved for future modules.</p>
      </div>
    </GlassPanel>
  );
}

function AchievementNotifications({ notifications, open, setOpen, onDismiss, onOpenAchievement }) {
  const recent = notifications.slice(0, 8);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(open ? "" : "notifications")}
        className="relative rounded-2xl px-3 py-2 text-white/72 transition hover:bg-white/12 hover:text-white"
        aria-label="Achievement notifications"
      >
        <Icon name="bell" size={18} />
        {recent.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-300" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="absolute right-0 top-12 w-80 rounded-3xl border border-white/15 bg-black/65 p-3 shadow-xl backdrop-blur-lg"
          >
            <div className="px-2 pb-2 text-sm font-black">Recent achievements</div>
            {recent.length ? (
              <div className="space-y-2">
                {recent.map((item, index) => (
                  <motion.button
                    type="button"
                    key={`${item.id}-${item.unlockedAt}`}
                    onClick={() => onOpenAchievement(item)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.07, duration: 0.18 }}
                    className="group relative w-full rounded-2xl bg-white/[0.07] p-3 pr-20 text-left transition hover:bg-white/[0.11]"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDismiss(item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onDismiss(item);
                        }
                      }}
                      className="absolute right-3 top-3 bg-gradient-to-r from-white via-purple-200 to-yellow-200 bg-clip-text text-xs font-black text-transparent opacity-0 transition group-hover:opacity-100"
                    >
                      Dismiss
                    </span>
                    <div className="text-sm font-bold">{item.name}</div>
                    <div className="mt-1 text-xs text-white/50">{item.groupLabel} · {formatRelativeTime(item.unlockedAt)}</div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.06] p-4 text-sm text-white/50">No achievement notifications yet.</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SiteNav({ authUser,onSchoolNotification,onTeacherHome, teacherLocked, view, setView, currentUser, profile, onLogout, onOwnProfile, achievementNotifications, isAdmin, onDismissAchievementNotification, onOpenAchievementNotification }) {
  const [openDropdown, setOpenDropdown] = useState("");
  const accountsOpen = openDropdown === "accounts";
  const navUsername = profile?.username || "Account";
  const navPhoto = profile?.photoURL || DEFAULT_PFP;

  const navButtonClass = (name) =>
    cx(
      "rounded-2xl px-4 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/12 hover:text-white",
      view === name && "bg-white/15 text-white shadow-lg"
    );

  const openView = (name) => {
    if (teacherLocked && ["home","dashboard","planner"].includes(name)) { onTeacherHome(); name="teacher"; }
    if (name === "dashboard") window.dispatchEvent(new Event("student-home"));
    setView(name);
    setOpenDropdown("");
  };

  return (
    <div className="site-navigation fixed left-1/2 top-4 z-50 w-[min(1200px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="flex items-center justify-between rounded-[1.7rem] border border-white/20 bg-white/[0.105] px-4 py-3 text-white shadow-xl backdrop-blur-lg">
        <button
          type="button"
          aria-label="Postcrastination home"
          onClick={() => openView(currentUser ? "dashboard" : "home")}
          className="flex items-center gap-3 rounded-2xl px-4 py-2 text-left transition hover:bg-white/10"
        >
          <span aria-hidden="true" className="brand-mark">P</span>
          <div>
            <div className="text-base font-black tracking-tight">Postcrastination</div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">focus for students</div>
          </div>
        </button>

        <div className="site-nav-actions flex items-center gap-2">
          {currentUser && <>
            <button type="button" onClick={() => openView("dashboard")} className={navButtonClass(teacherLocked ? "teacher" : "dashboard")}>Home</button>
            {!teacherLocked && <button type="button" onClick={() => openView("planner")} className={navButtonClass("planner")}>Planner</button>}
            {teacherLocked && <button type="button" onClick={() => openView("teacher")} className={navButtonClass("teacher")}>Teach</button>}
          </>}
          <button type="button" onClick={() => openView("pricing")} className={cx(navButtonClass("pricing"), currentUser && "secondary-nav")}>
            Pricing
          </button>
          <button type="button" onClick={() => openView("community")} className={cx(navButtonClass("community"), "secondary-nav")}>
            Community
          </button>

          {!currentUser ? (
            <button type="button" onClick={() => openView("login")} className={navButtonClass("login")}>
              Login
            </button>
          ) : (
            <>
            <NotificationMenu user={authUser} open={openDropdown === "notifications"} setOpen={setOpenDropdown} onSchool={onSchoolNotification} achievements={achievementNotifications} onAchievement={onOpenAchievementNotification} onDismissAchievement={onDismissAchievementNotification}/>
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={accountsOpen}
                onClick={() => setOpenDropdown(accountsOpen ? "" : "accounts")}
                className={cx(
                  "flex max-w-[210px] items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/12 hover:text-white",
                  accountsOpen && "bg-white/15 text-white shadow-lg"
                )}
              >
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">
                  <img src={navPhoto} alt="" className={cx("h-full w-full object-cover", !profile?.photoURL && "scale-[1.62]")} />
                </span>
                <span className="min-w-0 truncate">{navUsername}</span>
              </button>

              <AnimatePresence>
                {accountsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    className="absolute right-0 top-12 w-44 rounded-3xl border border-white/15 bg-black/55 p-2 shadow-xl backdrop-blur-lg"
                  >
                    <button type="button" onClick={() => openView("achievements")} className="w-full rounded-2xl px-4 py-3 text-left text-sm text-white/75 hover:bg-white/12 hover:text-white">
                      Achievements
                    </button>
                    {isAdmin && (
                      <button type="button" onClick={() => openView("admin")} className="w-full rounded-2xl px-4 py-3 text-left text-sm text-yellow-100 hover:bg-yellow-300/12 hover:text-white">
                        Admin panel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onOwnProfile();
                        openView("profile");
                      }}
                      className="w-full rounded-2xl px-4 py-3 text-left text-sm text-white/75 hover:bg-white/12 hover:text-white"
                    >
                      Profile
                    </button>
                    <button type="button" onClick={() => openView("settings")} className="w-full rounded-2xl px-4 py-3 text-left text-sm text-white/75 hover:bg-white/12 hover:text-white">
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdown("");
                        onLogout();
                      }}
                      className="w-full rounded-2xl px-4 py-3 text-left text-sm text-white/75 hover:bg-white/12 hover:text-white"
                    >
                      Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HomePage({ setView }) {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8 pb-16 pt-36 text-white">
      <div className="grid w-full items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="text-sm uppercase tracking-[0.38em] text-white/55">student concentration system</div>
          <h1 className="mt-5 max-w-3xl text-6xl font-black leading-[0.95] tracking-tight md:text-7xl">
            Study with less chaos.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
            Placeholder company introduction text goes here. Postcrastination helps students plan work, start focus sessions, track progress, and build a calmer routine around study time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <GlassButton onClick={() => setView("login")} className="px-6 py-3">
              Start studying
            </GlassButton>
            <GlassButton onClick={() => setView("pricing")} className="px-6 py-3">
              View pricing
            </GlassButton>
          </div>
        </div>

        <GlassPanel className="p-6">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/50">Today</div>
                <div className="mt-1 text-2xl font-bold">Revision plan</div>
              </div>
              <div className="rounded-2xl bg-orange-400/20 px-3 py-2 text-sm text-orange-100">3 tasks</div>
            </div>
            <div className="mt-6 space-y-3">
              {["Choose the first task", "Start a focus interval", "Watch progress climb"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold">{index + 1}</div>
                  <div className="font-medium">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

function PricingPage() {
  return (
    <section className="mx-auto min-h-screen max-w-6xl px-8 pb-16 pt-36 text-white">
      <div className="max-w-2xl">
        <div className="text-sm uppercase tracking-[0.38em] text-white/55">pricing</div>
        <h2 className="mt-4 text-5xl font-black tracking-tight">Simple placeholder plans</h2>
        <p className="mt-4 text-white/65">Replace this copy with the real pricing once the product offer is ready.</p>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {["Starter", "Student Plus", "School"].map((plan, index) => (
          <GlassPanel key={plan} className="p-6">
            <div className="text-xl font-bold">{plan}</div>
            <div className="mt-4 text-4xl font-black">{index === 0 ? "$0" : index === 1 ? "$4" : "Custom"}</div>
            <p className="mt-4 min-h-20 text-sm leading-6 text-white/60">Placeholder plan description for concentration tools, study planning, and student support features.</p>
            <GlassButton className="mt-5 w-full">Choose plan</GlassButton>
          </GlassPanel>
        ))}
      </div>
    </section>
  );
}

function LoginPage({ setView, onDevBypass }) {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    firstName: "",
    middleName: "",
    lastName: "",
    studyLocation: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validateSignup = () => {
    if (normalizeUsername(form.username).length < 3) return "Username needs at least 3 letters or numbers.";
    if (!form.firstName.trim()) return "First name is required.";
    if (!form.lastName.trim()) return "Last name is required.";
    if (!form.email.trim()) return "Email is required.";
    if (form.password.length < 6) return "Password needs to be at least 6 characters.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    return "";
  };

  const runAuthAction = async (action) => {
    if (!firebaseReady || !auth) {
      setError("Firebase sign-in is not connected yet. Add the web app configuration to the RPTPC .env file, then restart Postcrastination.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await action();
      setView("dashboard");
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
    } finally {
      setLoading(false);
    }
  };

  const submitEmailAuth = (event) => {
    event.preventDefault();

    runAuthAction(async () => {
      if (mode === "signup") {
        const validationError = validateSignup();
        if (validationError) throw new Error(validationError);
        await assertUsernameAvailable(form.username);

        const credential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        const profile = {
          uid: credential.user.uid,
          userId: "pending",
          username: form.username.trim(),
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim(),
          lastName: form.lastName.trim(),
          studyLocation: form.studyLocation.trim(),
          email: credential.user.email,
          photoURL: "",
          profileVisibility: "public",
          weekendsCount: true,
          totalStudyMinutes: 0,
          currentStreak: 0,
          longestStreak: 0,
          authProvider: "password",
        };

        await updateProfile(credential.user, {
          displayName: profile.username,
        });
        try { await syncCommunityUser(credential.user, {username:profile.username,fullName:[profile.firstName,profile.middleName,profile.lastName].filter(Boolean).join(' ')}); } catch { /* Account sync retries when the backend returns. */ }

        try {
          await reserveUsernameAndProfile(credential.user, profile);
        } catch (profileError) {
          console.warn("Account created, but Firebase profile save failed.", profileError);
          writeLocalCache(`pendingProfile:${credential.user.uid}`, profile);
        }
        return;
      }

      const loginEmail = await resolveEmailOrUsername(form.email);
      await loginEmailAccount(loginEmail, form.password);
    });
  };

  const loginWithProvider = (provider, providerName) => {
    runAuthAction(async () => {
      const credential = await loginGoogle(provider);
      await ensureOAuthProfile(credential.user, providerName);
    });
  };

  const authInputClass =
    "w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/30";

  return (
    <section className="mx-auto flex min-h-screen max-w-2xl items-center px-8 pb-16 pt-36 text-white">
      <GlassPanel className="w-full p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight">{mode === "signup" ? "Create account" : "Login"}</h2>
            <p className="mt-2 text-sm text-white/60">Your personal study account. School accounts use school login.</p>
          </div>
          <div className="flex rounded-2xl border border-white/10 bg-black/25 p-1">
            {["login", "signup"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError("");
                }}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-bold capitalize text-white/60 transition",
                  mode === item && "bg-white/15 text-white shadow-lg"
                )}
              >
                {item === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submitEmailAuth} className="mt-6 space-y-3">
          {mode === "signup" && (
            <>
              <input value={form.username} onChange={(event) => updateForm("username", event.target.value)} className={authInputClass} placeholder="Username, minimum 3 characters" />
              <div className="grid gap-3 md:grid-cols-3">
                <input value={form.firstName} onChange={(event) => updateForm("firstName", event.target.value)} className={authInputClass} placeholder="First name" />
                <input value={form.middleName} onChange={(event) => updateForm("middleName", event.target.value)} className={authInputClass} placeholder="Middle name, optional" />
                <input value={form.lastName} onChange={(event) => updateForm("lastName", event.target.value)} className={authInputClass} placeholder="Last name" />
              </div>
              <input value={form.studyLocation} onChange={(event) => updateForm("studyLocation", event.target.value)} className={authInputClass} placeholder="Study location, optional but recommended" />
            </>
          )}

          <input
            value={form.email}
            onChange={(event) => updateForm("email", event.target.value)}
            className={authInputClass}
            placeholder={mode === "signup" ? "Email" : "Email or username"}
            type={mode === "signup" ? "email" : "text"}
            autoComplete={mode === "signup" ? "email" : "username"}
          />

          <div className="relative">
            <input
              value={form.password}
              onChange={(event) => updateForm("password", event.target.value)}
              className={`${authInputClass} pr-24`}
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <button type="button" onClick={() => setShowPassword((show) => !show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white">
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {mode === "signup" && (
            <div className="relative">
              <input
                value={form.confirmPassword}
                onChange={(event) => updateForm("confirmPassword", event.target.value)}
                className={`${authInputClass} pr-24`}
                placeholder="Confirm password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirmPassword((show) => !show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white">
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          )}

          {error && <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

          <GlassButton type="submit" className="w-full py-3" disabled={loading}>
            {loading ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
          </GlassButton>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-white/35">
          <div className="h-px flex-1 bg-white/10" />
          or
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid gap-3">
          <GlassButton onClick={() => loginWithProvider(googleProvider, "google")} className="py-3" disabled={loading}>
            Continue with Google
          </GlassButton>
        </div>

        {import.meta.env.DEV && onDevBypass && (
          <GlassButton onClick={onDevBypass} className="mt-3 w-full border-purple-200/25 bg-gradient-to-r from-white/16 via-purple-400/20 to-yellow-300/20 py-3">
            Bypass login for testing
          </GlassButton>
        )}

        {!firebaseReady && (
          <p className="mt-4 rounded-2xl border border-yellow-200/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-50">
            Firebase sign-in is not connected yet. The app needs the web configuration from your Firebase project. Your local demo remains available.
          </p>
        )}
      </GlassPanel>
    </section>
  );
}

function PlannerPage() {
  const [plannerInput, setPlannerInput] = useLocalCacheState("plannerInput", {
    prompt: "Make me a study schedule for biology active recall, chemistry practice questions, and maths homework. I want harder work first and short breaks.",
    existingEvents: "Dinner 18:30-19:00",
    pomodoroMethod: "25/5 Pomodoro",
    availableFrom: "16:00",
    availableTo: "20:00",
    includeSleep: true,
  });
  const [messages, setMessages] = useLocalCacheState("plannerMessages", [
    {
      role: "assistant",
      text: "Tell me what you need to study, your available time, and whether you want sleep/wake prep included.",
    },
  ]);
  const [scheduleJson, setScheduleJson] = useLocalCacheState("plannerSchedule", null);
  const [loading, setLoading] = useState(false);
  const calendarEvents = readScheduleEvents(scheduleJson);

  const updatePlannerInput = (key, value) => {
    setPlannerInput((current) => ({ ...current, [key]: value }));
  };

  const generatePlan = async () => {
    setLoading(true);
    setMessages((current) => [...current, { role: "user", text: plannerInput.prompt || plannerInput.tasksText }]);

    const localPlan = createLocalStudyPlan(plannerInput);
    let result = { ok: false, schedule: localPlan, error: "" };

    if (window.postcrastinationAI?.createSchedule) {
      result = await window.postcrastinationAI.createSchedule(plannerInput);
    }

    const nextSchedule = result.ok ? result.schedule : localPlan;
    setScheduleJson(nextSchedule);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: result.ok
          ? nextSchedule.summary || "I made a JSON study schedule."
          : `Local calendar draft made. ${result.error || "Open the Electron desktop app to use the OpenRouter backend."}`,
      },
    ]);
    setLoading(false);
  };

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-8 pb-10 pt-36 text-white">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <GlassPanel className="p-6">
          <div className="flex items-center gap-2">
            <Icon name="bot" size={18} />
            <h2 className="text-2xl font-black tracking-tight">AI schedule planner</h2>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm text-white/60">Prompt</span>
              <textarea
                value={plannerInput.prompt || plannerInput.tasksText || ""}
                onChange={(event) => updatePlannerInput("prompt", event.target.value)}
                className="mt-2 h-36 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none placeholder:text-white/35"
                placeholder="Tell the planner what to study, what order you prefer, and any constraints..."
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="text-sm text-white/60">Pomodoro method</span>
                <input
                  value={plannerInput.pomodoroMethod || ""}
                  onChange={(event) => updatePlannerInput("pomodoroMethod", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none placeholder:text-white/35"
                  placeholder="25/5, 50/10, 90/20..."
                />
              </label>
              <label>
                <span className="text-sm text-white/60">Events today</span>
                <input
                  value={plannerInput.existingEvents || ""}
                  onChange={(event) => updatePlannerInput("existingEvents", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none placeholder:text-white/35"
                  placeholder="Dinner 18:30, club 20:00..."
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="text-sm text-white/60">Available from</span>
                <input
                  type="time"
                  value={plannerInput.availableFrom}
                  onChange={(event) => updatePlannerInput("availableFrom", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none"
                />
              </label>
              <label>
                <span className="text-sm text-white/60">Available until</span>
                <input
                  type="time"
                  value={plannerInput.availableTo}
                  onChange={(event) => updatePlannerInput("availableTo", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>
            <label className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={plannerInput.includeSleep}
                onChange={(event) => updatePlannerInput("includeSleep", event.target.checked)}
                className="h-4 w-4 accent-orange-300"
              />
              Include sleep preparation and wake-up advice
            </label>
            <GlassButton onClick={generatePlan} disabled={loading} className="w-full py-3">
              {loading ? "Making calendar..." : "Generate calendar"}
            </GlassButton>
          </div>

          <div className="mt-5 space-y-3">
            {messages.slice(-4).map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cx(
                  "rounded-2xl px-4 py-3 text-sm leading-6",
                  message.role === "assistant" ? "bg-white/[0.07] text-white/70" : "bg-orange-400/20 text-white"
                )}
              >
                {message.text}
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold">Calendar plan</h3>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">AI schedule reader</span>
          </div>
          {scheduleJson ? (
            <div className="mt-5 grid gap-4">
              {scheduleJson.summary && (
                <div className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white/70">
                  {scheduleJson.summary}
                </div>
              )}
              <div className="grid gap-3">
                {calendarEvents.map((item) => (
                  <div key={item.id} className="grid grid-cols-[92px_1fr] gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="rounded-2xl bg-white/[0.07] px-3 py-2 text-center">
                      <div className="text-xs text-white/45">{item.start}</div>
                      <div className="text-[11px] text-white/30">to</div>
                      <div className="text-xs text-white/45">{item.end}</div>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{item.title}</div>
                        <span className={cx(
                          "rounded-full px-2 py-1 text-[10px]",
                          item.type === "event" ? "bg-purple-400/20 text-purple-100" : "bg-orange-400/20 text-orange-100"
                        )}>
                          {item.type === "event" ? "Event" : "Study"}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-orange-100/80">{item.method}</div>
                      <p className="mt-2 text-xs leading-5 text-white/55">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-5 py-16 text-center text-sm text-white/40">
              Your generated schedule will appear here.
            </div>
          )}
        </GlassPanel>
      </div>
    </section>
  );
}

const alexanderProfile = ALEXANDER_PROFILE;

function EquippedTitlePill({ achievement, onOpenAchievement }) {
  const [open, setOpen] = useState(false);
  if (!achievement) return null;

  return (
    <span
      className="profile-equipped-title group relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => onOpenAchievement?.(achievement)}
        className={cx("profile-equipped-title-button rounded-full border transition hover:brightness-110", rarityStyles[achievement.rarity])}
      >
        {achievement.name}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="absolute left-0 top-full z-50 mt-3 w-72 rounded-3xl border border-white/15 bg-black/80 p-4 text-left text-white shadow-2xl backdrop-blur-xl"
          >
            <div className={cx("inline-flex rounded-full border px-3 py-1 text-[10px] font-normal uppercase tracking-[0.18em]", rarityStyles[achievement.rarity])}>
              {achievement.rarity}
            </div>
            <div className="mt-3 text-base font-normal">{achievement.name}</div>
            <p className="mt-2 text-xs leading-5 text-white/60">{achievement.description}</p>
            <GlassButton onClick={() => onOpenAchievement?.(achievement)} className="mt-3 w-full py-2 text-xs">
              Open in achievements
            </GlassButton>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

export function ProfilePage({ currentUser, profile, setProfile, viewedProfile, achievementStats, equippedAchievementId, onOpenAchievement }) {
  const visibleProfile = viewedProfile || profile || alexanderProfile;
  const isOwnProfile = Boolean(profile && visibleProfile?.uid === profile.uid);
  const [completedFocusMinutes] = useLocalCacheState("completedFocusMinutes", 0);
  const [targetHours] = useLocalCacheState("goalTargetHours", 3);
  const [targetMinutes] = useLocalCacheState("goalTargetMinutes", 0);
  const [studyLog, setStudyLog] = useLocalCacheState("studyLog", {});
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState({
    photoURL: visibleProfile?.photoURL || "",
    studyLocation: visibleProfile?.studyLocation || "",
    profileVisibility: visibleProfile?.profileVisibility || "public",
    weekendsCount: visibleProfile?.weekendsCount ?? true,
  });

  useEffect(() => {
    let active = true;
    if (currentUser?.getIdToken && !viewedProfile) {
      syncCommunityUser(currentUser).then(shared => {
        if (active) setDraft(draft => ({...draft, profileVisibility: shared.profileVisibility, studyLocation: shared.studyLocation || ""}));
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [currentUser?.uid, viewedProfile?.uid]);

  const goalMinutes = targetHours * 60 + targetMinutes;
  const today = todayKey();
  const todayComplete = goalMinutes > 0 && completedFocusMinutes >= goalMinutes;
  const streaks = calculateStudyStreak(studyLog, draft.weekendsCount);
  const profileStats = {
    ...achievementStats,
    completedFocusMinutes: Math.max(achievementStats.completedFocusMinutes || 0, Number(visibleProfile.totalStudyMinutes || 0)),
    longestStreak: Math.max(achievementStats.longestStreak || 0, Number(visibleProfile.longestStreak || 0), streaks.longest),
    xpTotal: isOwnProfile ? achievementStats.xpTotal : Number(visibleProfile.xpTotal || 0),
  };
  const topAchievements = getTopAchievements(profileStats);
  const equippedAchievement = allAchievements.find((item) => item.id === equippedAchievementId);
  const levelInfo = getLevelProgress(profileStats.xpTotal);

  useEffect(() => {
    setDraft({
      photoURL: visibleProfile?.photoURL || "",
      studyLocation: visibleProfile?.studyLocation || "",
      profileVisibility: visibleProfile?.profileVisibility || "public",
      weekendsCount: visibleProfile?.weekendsCount ?? true,
    });
  }, [visibleProfile?.uid]);

  useEffect(() => {
    if (!isOwnProfile) return;
    setStudyLog((current) => ({
      ...current,
      [today]: {
        completed: todayComplete,
        minutes: completedFocusMinutes,
      },
    }));
  }, [completedFocusMinutes, isOwnProfile, setStudyLog, today, todayComplete]);

  const limitedView = !isOwnProfile && visibleProfile.profileVisibility !== "public";

  const saveProfile = async () => {
    const next = {
      ...profile,
      photoURL: draft.photoURL,
      studyLocation: draft.studyLocation,
      profileVisibility: draft.profileVisibility,
      weekendsCount: draft.weekendsCount,
      totalStudyMinutes: Math.max(Number(profile?.totalStudyMinutes || 0), completedFocusMinutes),
      currentStreak: streaks.current,
      longestStreak: Math.max(Number(profile?.longestStreak || 0), streaks.longest),
      xpTotal: profileStats.xpTotal,
    };

    if (currentUser && db && profile?.uid !== "dev-bypass") {
      await updateDoc(doc(db, "users", currentUser.uid), {
        photoURL: next.photoURL,
        studyLocation: next.studyLocation,
        profileVisibility: next.profileVisibility,
        weekendsCount: next.weekendsCount,
        totalStudyMinutes: next.totalStudyMinutes,
        currentStreak: next.currentStreak,
        longestStreak: next.longestStreak,
        xpTotal: next.xpTotal,
        updatedAt: serverTimestamp(),
      });
    }

    if (currentUser?.getIdToken) {
      try { await syncCommunityUser(currentUser, {visible:next.profileVisibility === "public",studyLocation:next.studyLocation || ""}); }
      catch { setSaved("Profile was not saved. Community could not connect; start the backend and try again."); return; }
    }
    if (currentUser && !db) writeLocalCache(`pendingProfile:${currentUser.uid}`, next);
    setProfile(next);
    setEditing(false);
    setSaved("Profile saved.");
  };

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-8 pb-16 pt-36 text-white">
      <GlassPanel className="p-7">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-5">
              <div className="relative aspect-square h-28 w-28 shrink-0 overflow-hidden rounded-full border border-white/15 bg-gradient-to-br from-white/25 via-purple-500/30 to-orange-300/30">
                <img src={visibleProfile.photoURL || DEFAULT_PFP} alt="" className={cx("h-full w-full object-cover", !visibleProfile.photoURL && "scale-[1.62]")} />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/35 bg-black/60 px-3 py-1 text-[11px] font-black shadow-lg backdrop-blur-md">
                  Level {levelInfo.level}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-[0.32em] text-white/45">/user/{visibleProfile.userId ?? "new"}</div>
                {equippedAchievement && isOwnProfile && <div className="mt-2"><EquippedTitlePill achievement={equippedAchievement} onOpenAchievement={onOpenAchievement} /></div>}
                <h2 className="mt-2 text-4xl font-black tracking-tight">
                  {visibleProfile.username || "Student"}
                </h2>
                <div className="mt-3 max-w-sm">
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>{levelInfo.xp.toLocaleString()} XP</span>
                    <span>{levelInfo.remaining.toLocaleString()} XP to Level {levelInfo.level + 1}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/35">
                    <div className="h-full rounded-full bg-gradient-to-r from-white via-purple-300 to-yellow-300" style={{ width: `${levelInfo.percent}%` }} />
                  </div>
                </div>
                {isOwnProfile && <GlassButton onClick={() => setEditing((open) => !open)} className="mt-3 px-4 py-2 text-xs">Edit profile</GlassButton>}
              </div>
            </div>

            {limitedView ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5 text-white/65">
                This profile is {visibleProfile.profileVisibility}. You can send a connection request.
                <GlassButton className="mt-4">Send connection request</GlassButton>
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ["Time studied", formatStudyTime(Math.max(completedFocusMinutes, Number(visibleProfile.totalStudyMinutes || 0)))],
                  ["Current streak", `${isOwnProfile ? streaks.current : visibleProfile.currentStreak || 0} days`],
                  ["Longest streak", `${Math.max(streaks.longest, Number(visibleProfile.longestStreak || 0))} days`],
                  ["Study location", visibleProfile.studyLocation || "Not shared"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</div>
                    <div className="profile-stat-value mt-2 text-xl font-normal">{value}</div>
                  </div>
                ))}
              </div>
            )}
            {!limitedView && topAchievements.length > 0 && (
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-sm font-black">Top achievements</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topAchievements.map((achievement) => (
                    <button
                      key={achievement.id}
                      type="button"
                      onClick={() => onOpenAchievement(achievement)}
                      className={cx("rounded-full border px-3 py-1 text-xs font-bold transition hover:scale-105", rarityStyles[achievement.rarity])}
                    >
                      {achievement.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
              <h3 className="text-xl font-black">StudyStreaks</h3>
              <p className="mt-2 text-sm text-white/60">Complete your daily goal on consecutive study days.</p>
              <label className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 text-sm">
                Weekends count
                <input type="checkbox" checked={draft.weekendsCount} disabled={!isOwnProfile} onChange={(event) => setDraft((current) => ({ ...current, weekendsCount: event.target.checked }))} />
              </label>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
              <h3 className="text-xl font-black">FriendStreaks</h3>
              <p className="mt-2 text-sm text-white/60">Friends choose one shared daily goal. Both people must hit it to keep the streak alive.</p>
              <div className="mt-4 rounded-2xl bg-black/20 p-4 text-sm text-white/55">
                No active friend streak yet. Connect with students from the community tab to start one.
              </div>
            </div>

            {editing && isOwnProfile && (
              <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                <h3 className="text-xl font-black">Edit profile</h3>
                <div className="mt-4 space-y-3">
                  <input value={draft.photoURL} onChange={(event) => setDraft((current) => ({ ...current, photoURL: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none" placeholder="Profile picture URL" />
                  <input value={draft.studyLocation} onChange={(event) => setDraft((current) => ({ ...current, studyLocation: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none" placeholder="Where you study" />
                  <select value={draft.profileVisibility} onChange={(event) => setDraft((current) => ({ ...current, profileVisibility: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/80 px-4 py-3 text-sm outline-none">
                    <option value="private">Private</option>
                    <option value="friends">Friends-only</option>
                    <option value="public">Public</option>
                  </select>
                  <GlassButton onClick={saveProfile} className="w-full py-3">Save profile</GlassButton>
                </div>
              </div>
            )}
            {saved && <div className="rounded-2xl bg-green-500/10 px-4 py-3 text-sm text-green-100">{saved}</div>}
          </div>
        </div>
      </GlassPanel>
    </section>
  );
}


function AchievementDetail({ achievement, stats, totalUsers, onBack, backLabel="Back to achievements" }) {
  const unlocked = getUnlockedAchievements(stats).some((item) => item.id === achievement.id);
  const audience = getAchievementAudience(achievement, totalUsers);

  return (
    <section className="achievement-page mx-auto min-h-screen max-w-5xl px-8 pb-16 pt-36 text-white">
      <GlassPanel className="p-8">
        <button type="button" onClick={onBack} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/15 hover:text-white">
          {backLabel}
        </button>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.65fr]">
          <div>
            <span className={cx("inline-flex rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em]", rarityStyles[achievement.rarity])}>
              {achievement.rarity}
            </span>
            <h2 className="mt-5 text-6xl font-black leading-none tracking-tight">{achievement.name}</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">{achievement.description}</p>
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-white/40">How to get it</div>
              <div className="mt-2 text-2xl font-black">{achievement.requirement}</div>
            </div>
          </div>
          <div className="space-y-4">
            {[
              ["Status", unlocked ? "Unlocked" : "Locked"],
              ["Category", achievement.groupLabel],
              ["Users with it", audience.holders.toLocaleString()],
              ["User percentage", `${audience.percent.toFixed(audience.percent < 1 ? 2 : 1)}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</div>
                <div className="mt-2 text-2xl font-black">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>
    </section>
  );
}

export function AchievementsPage({ stats, initialOpenGroup, selectedAchievementId, setSelectedAchievementId, totalUsers, detailOrigin="achievements", onBackFromDetail }) {
  const unlocked = getUnlockedAchievements(stats);
  const unlockedIds = new Set(unlocked.map((item) => item.id));
  const [openGroup, setOpenGroup] = useState("");
  const selectedAchievement = allAchievements.find((achievement) => achievement.id === selectedAchievementId);

  useEffect(() => {
    if (initialOpenGroup) setOpenGroup(initialOpenGroup);
  }, [initialOpenGroup]);

  if (selectedAchievement) {
    return <AchievementDetail achievement={selectedAchievement} stats={stats} totalUsers={totalUsers} backLabel={detailOrigin==="profile"?"Back to profile":"Back to achievements"} onBack={onBackFromDetail||(()=>setSelectedAchievementId(""))} />;
  }

  return (
    <section className="achievement-page mx-auto min-h-screen max-w-7xl px-8 pb-16 pt-36 text-white">
      <div className="mb-6">
        <div className="text-sm uppercase tracking-[0.38em] text-white/55">achievements</div>
        <h2 className="mt-3 text-5xl font-black tracking-tight">{unlocked.length} unlocked</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {achievementGroups.map((group) => {
          const isOpen = openGroup === group.key;
          const groupAchievements = allAchievements.filter((achievement) => achievement.groupKey === group.key);
          const groupUnlocked = groupAchievements.filter((achievement) => unlockedIds.has(achievement.id)).length;
          return (
            <motion.div key={group.key} layout className={cx(isOpen && "lg:col-span-2")}>
              <GlassPanel className="p-5">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? "" : group.key)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <h3 className="text-xl font-black">{group.label}</h3>
                    <div className="mt-1 text-sm text-white/45">{groupUnlocked} / {group.milestones.length} unlocked</div>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
                    {getAchievementValue(stats, group.key)} {group.unit}
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {groupAchievements.map((achievement) => {
                          const id = achievement.id;
                          const isUnlocked = unlockedIds.has(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setSelectedAchievementId(id)}
                              className={cx("rounded-2xl border p-3 text-left transition hover:scale-[1.02]", isUnlocked ? rarityStyles[achievement.rarity] : "border-white/10 bg-black/20 opacity-55")}
                            >
                              <div className="flex items-center gap-2">
                                <Icon name="trophy" size={15} />
                                <div className="text-sm font-black">{achievement.name}</div>
                              </div>
                              <div className="mt-1 text-xs text-white/50">{achievement.requirement}</div>
                              <p className="mt-2 text-xs leading-5 text-white/55">{achievement.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassPanel>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function AdminPanelPage({
  completedFocusMinutes,
  setCompletedFocusMinutes,
  studyPeriods,
  setStudyPeriods,
  tasksMade,
  setTasksMade,
  longestStreakOverride,
  setLongestStreakOverride,
  achievementNotifications,
  setAchievementNotifications,
  setKnownAchievementIds,
  specialBadges,
  setSpecialBadges,
  xpTotal,
  setXpTotal,
  setXpToday,
  setDailyFocusXpMinutes,
  setDailyTaskXpCount,
  setXpEvents,
  setStudyDayHistory,
  setFarmingFlags,
}) {
  const numberInputClass = "mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xl font-black outline-none";
  const setNumber = (setter) => (event) => setter(Math.max(0, Number(event.target.value) || 0));
  const levelInfo = getLevelProgress(xpTotal);

  const addAdminXp = (event) => {
    if (!event.target.value) return;
    const amount = Math.max(0, Number(event.target.value) || 0);
    setXpTotal((current) => current + amount);
    event.target.value = "";
  };

  const overwriteLevel = (event) => {
    if (!event.target.value) return;
    const level = Math.max(1, Number(event.target.value) || 1);
    setXpTotal(getLevelThreshold(level));
    event.target.value = "";
  };

  const resetAchievements = () => {
    setKnownAchievementIds([]);
    setAchievementNotifications([]);
  };

  return (
    <section className="mx-auto min-h-screen max-w-5xl px-8 pb-16 pt-36 text-white">
      <GlassPanel className="p-7">
        <div className="text-sm uppercase tracking-[0.38em] text-yellow-100/70">admin only</div>
        <h2 className="mt-3 text-5xl font-black tracking-tight">Achievement test panel</h2>
        <p className="mt-3 max-w-2xl text-white/60">Only user ID 1 can see this. Use it to test achievement unlocks and profile titles quickly.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <span className="text-sm font-bold text-white/70">Time studied, minutes</span>
            <input type="number" min="0" value={completedFocusMinutes} onChange={setNumber(setCompletedFocusMinutes)} className={numberInputClass} />
            <div className="mt-2 text-xs text-white/45">{formatStudyTime(completedFocusMinutes)}</div>
          </label>
          <label className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <span className="text-sm font-bold text-white/70">Study periods</span>
            <input type="number" min="0" value={studyPeriods} onChange={setNumber(setStudyPeriods)} className={numberInputClass} />
          </label>
          <label className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <span className="text-sm font-bold text-white/70">Tasks made</span>
            <input type="number" min="0" value={tasksMade} onChange={setNumber(setTasksMade)} className={numberInputClass} />
          </label>
          <label className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <span className="text-sm font-bold text-white/70">Longest streak override</span>
            <input type="number" min="0" value={longestStreakOverride} onChange={setNumber(setLongestStreakOverride)} className={numberInputClass} />
          </label>
          <label className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <span className="text-sm font-bold text-white/70">Add XP</span>
            <input type="number" min="0" placeholder="Amount to add" onBlur={addAdminXp} onKeyDown={(event) => event.key === "Enter" && addAdminXp(event)} className={numberInputClass} />
            <div className="mt-2 text-xs text-white/45">{xpTotal.toLocaleString()} XP · Level {levelInfo.level}</div>
          </label>
          <label className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <span className="text-sm font-bold text-white/70">Overwrite level count</span>
            <input type="number" min="1" placeholder="Level number" onBlur={overwriteLevel} onKeyDown={(event) => event.key === "Enter" && overwriteLevel(event)} className={numberInputClass} />
            <div className="mt-2 text-xs text-white/45">Sets XP to that level threshold.</div>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <GlassButton onClick={() => {
            setCompletedFocusMinutes(0);
            setStudyPeriods(0);
            setTasksMade(0);
            setLongestStreakOverride(0);
            setXpTotal(0);
            setXpToday({ date: todayKey(), value: 0 });
            setDailyFocusXpMinutes({});
            setDailyTaskXpCount({});
            setXpEvents([]);
            setStudyDayHistory({});
            setFarmingFlags([]);
            resetAchievements();
          }}>
            Reset test stats
          </GlassButton>
          <GlassButton onClick={resetAchievements}>Replay achievement unlocks</GlassButton>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-sm font-black">Notification queue</div>
          <div className="mt-2 text-sm text-white/55">{achievementNotifications.length} recent achievement notifications saved.</div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <div className="text-xl font-black">Special badges</div>
          <p className="mt-2 text-sm text-white/55">Admin-only or paid badges for the current testing profile.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {allAchievements.filter((achievement) => achievement.special).map((badge) => {
              const active = specialBadges.includes(badge.id);
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() =>
                    setSpecialBadges((current) =>
                      current.includes(badge.id) ? current.filter((id) => id !== badge.id) : [...current, badge.id]
                    )
                  }
                  className={cx("rounded-2xl border p-3 text-left transition", active ? rarityStyles[badge.rarity] : "border-white/10 bg-black/20 text-white/55")}
                >
                  <div className="text-sm font-black">{badge.name}</div>
                  <div className="mt-1 text-xs opacity-75">{active ? "Granted" : "Not granted"}</div>
                </button>
              );
            })}
          </div>
        </div>
      </GlassPanel>
    </section>
  );
}

export function SettingsPage({ onAppearance,currentUser, achievementStats, equippedAchievementId, setEquippedAchievementId }) {
  const [newPassword, setNewPassword] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [message, setMessage] = useState("");
  const linkedProviders = currentUser?.providerData?.map((provider) => provider.providerId) || [];
  const hasGoogle = linkedProviders.includes("google.com");
  const hasPassword = linkedProviders.includes("password");
  const unlockedAchievements = getUnlockedAchievements(achievementStats);

  const changePassword = async () => {
    if (!currentUser) {
      setMessage("Sign in with email/password to change your password.");
      return;
    }
    if (newPassword.length < 6) {
      setMessage("Password needs at least 6 characters.");
      return;
    }

    try {
      await updatePassword(currentUser, newPassword);
      setNewPassword("");
      setMessage("Password updated.");
    } catch (error) {
      setMessage(getFriendlyAuthError(error));
    }
  };

  const connectGoogle = async () => {
    if (!currentUser) {
      setMessage("Sign in first, then connect Google.");
      return;
    }
    if (hasGoogle) {
      setMessage("Google is already connected.");
      return;
    }

    try {
      await linkWithPopup(currentUser, googleProvider);
      setMessage("Google connected. You can now sign in with Google too.");
    } catch (error) {
      setMessage(getFriendlyAuthError(error));
    }
  };

  const addPasswordSignIn = async () => {
    if (!currentUser?.email) {
      setMessage("Your Google account needs an email before adding a password.");
      return;
    }
    if (hasPassword) {
      setMessage("Password sign-in is already enabled.");
      return;
    }
    if (backupPassword.length < 6) {
      setMessage("Backup password needs at least 6 characters.");
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, backupPassword);
      await linkWithCredential(currentUser, credential);
      setBackupPassword("");
      setMessage("Password sign-in added. You can now use email/password too.");
    } catch (error) {
      setMessage(getFriendlyAuthError(error));
    }
  };

  return (
    <section className="account-settings mx-auto flex min-h-screen w-full max-w-[1440px] items-start px-4 pb-16 pt-36 text-white sm:px-8">
      <GlassPanel className="w-full min-w-0 p-5 sm:p-8">
        <div className="text-sm uppercase tracking-[0.38em] text-white/55">account settings</div>
        <h2 className="mt-4 text-4xl font-black tracking-tight">Settings</h2>
        <section className="workspace-card account-appearance-card mt-6" aria-labelledby="account-appearance-heading"><h3 id="account-appearance-heading">Appearance &amp; accessibility</h3><p>Choose your theme, text size, contrast and motion preferences.</p><button className="workspace-secondary" onClick={onAppearance}>Open appearance settings</button></section>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <h3 className="text-xl font-black">Equipped title</h3>
          <p className="mt-2 text-sm text-white/60">Pick an unlocked achievement to show before your username.</p>
          <div className="account-title-picker" aria-label="Choose your equipped title">
            <button
              type="button"
              onClick={() => setEquippedAchievementId("")}
              aria-pressed={equippedAchievementId === ""}
              className={cx(
                "account-title-option rounded-2xl border p-4 text-left transition",
                equippedAchievementId === "" ? "border-white/55 bg-white/15 shadow-lg shadow-white/10" : "border-white/10 bg-black/20 text-white/65"
              )}
            >
              <div className="text-sm font-black">No title</div>
              <div className="mt-1 text-xs opacity-70">Show only your username.</div>
            </button>
            {unlockedAchievements.map((achievement) => {
              const selected = equippedAchievementId === achievement.id;
              return (
                <button
                  key={achievement.id}
                  type="button"
                  onClick={() => setEquippedAchievementId(achievement.id)}
                  aria-pressed={selected}
                  className={cx(
                    "account-title-option rounded-2xl border p-4 text-left transition",
                    rarityStyles[achievement.rarity],
                    selected && "account-title-selected"
                  )}
                >
                  <div className="account-title-header">
                    <div className="account-title-name text-sm font-black">{achievement.name}</div>
                    <div className="account-title-rarity rounded-full bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
                      {achievement.rarity}
                    </div>
                  </div>
                  <div className="mt-2 text-xs opacity-75">{achievement.groupLabel}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <h3 className="text-xl font-black">Sign-in methods</h3>
          <p className="mt-2 text-sm text-white/60">Connect extra ways to sign in so you do not get locked out.</p>
          <div className="account-signin-grid mt-4">
            <div className="rounded-2xl bg-black/20 p-4">
              <div className="text-sm font-bold">Google</div>
              <div className="mt-1 text-xs text-white/50">{hasGoogle ? "Connected" : "Not connected"}</div>
              <GlassButton onClick={connectGoogle} disabled={!currentUser || hasGoogle} className="mt-3 w-full">
                Connect Google
              </GlassButton>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <div className="text-sm font-bold">Password backup</div>
              <div className="mt-1 text-xs text-white/50">{hasPassword ? "Enabled" : "Useful if you signed in with Google"}</div>
              {!hasPassword && (
                <div className="mt-3 flex gap-2">
                  <input value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} type="password" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none" placeholder="Backup password" />
                  <GlassButton onClick={addPasswordSignIn}>Add</GlassButton>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
          <h3 className="text-xl font-black">Change password</h3>
          <p className="mt-2 text-sm text-white/60">Firebase may ask you to log in again if your session is old.</p>
          <div className="mt-4 flex gap-3">
            <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none" placeholder="New password" />
            <GlassButton onClick={changePassword}>Update</GlassButton>
          </div>
          {message && <div className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">{message}</div>}
        </div>
      </GlassPanel>
    </section>
  );
}

export function DashboardApp({ schoolAccount=false,notificationTarget,workspaceMode,setWorkspaceMode,currentUser, schoolViewer, schoolDemo, theme, setTheme, setView, completedFocusMinutes, setCompletedFocusMinutes, setStudyPeriods, onTaskCreated, onPomodoroComplete, getActivitySnapshot }) {
  const [section, setSection] = useState("learning");
  const [localPersonalTasks, setLocalPersonalTasks] = useLocalCacheState("tasks", initialTasks);
  const personalStore = usePersonalTasks(currentUser);
  const personalTasks = currentUser ? personalStore.tasks : localPersonalTasks;
  const setPersonalTasks = setLocalPersonalTasks;
  const [schoolData] = useSchoolData();
  const liveSchool = useLiveSchool(schoolAccount ? currentUser : null);
  const assignedTasks = !schoolAccount ? [] : currentUser ? liveSchool.data.assignments.filter(a => !a.owned && !a.done && a.details.addToTasks).map(a => ({id:'school:'+a.id,schoolAssignmentId:a.id,name:a.title,dueDate:a.details.due,urgency:'Medium',labels:['School',a.class_name]})) : schoolTasks(schoolData, schoolViewer);
  const tasks = [...personalTasks.filter(t => !t.schoolAssignmentId), ...assignedTasks];
  const setTasks = updater => setPersonalTasks(current => { const combined = [...current.filter(t => !t.schoolAssignmentId), ...assignedTasks]; return (typeof updater === "function" ? updater(combined) : updater).filter(t => !t.schoolAssignmentId); });

  const [homeRequest, setHomeRequest] = useState(0);
  useEffect(() => { const home = () => { if(!schoolAccount)setSection("learning"); setWorkspaceMode("home"); setHomeRequest(n => n + 1); setCustomizeOpen(false); }; window.addEventListener("student-home", home); return () => window.removeEventListener("student-home", home); }, [schoolAccount]);
  useEffect(()=>{const study=()=>{setSection("learning");setCustomizeOpen(false);};window.addEventListener("student-study",study);return()=>window.removeEventListener("student-study",study);},[]);
  const inSchoolMode = schoolAccount && !["personal","todo"].includes(workspaceMode);
  useEffect(()=>{if(workspaceMode==="todo")setSection("tasks");if(workspaceMode==="personal")setSection("learning");},[workspaceMode]);
  const [modules, setModules] = useLocalCacheState("modules", defaultModules);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [moduleEditOpen, setModuleEditOpen] = useState(false);
  const upcoming = tasks.filter(t=>!t.completed).sort((a,b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).slice(0,3);
  const sections = [["learning", "Learning"], ["today", "Study tools"], ["tasks", "Tasks"], ["calendar", "Calendar"]];
  const dashboardTasks=currentUser?[...personalTasks.filter(t=>!t.completed),...liveSchool.data.assignments.filter(a=>!a.owned&&!a.done).map(a=>({id:'school:'+a.id,schoolAssignmentId:a.id,name:a.title,dueDate:a.details.due}))]:tasks.filter(t=>!t.completed);
  const personalTaskPanel = <PersonalTasks user={currentUser} store={personalStore} tasks={personalTasks.filter(t=>!t.schoolAssignmentId)} onLocalChange={setLocalPersonalTasks} legacyTasks={localPersonalTasks} onTaskCreated={onTaskCreated}/>;
  useEffect(() => { runSelfTests(); }, []);
  return <section className="study-workspace student-dashboard relative z-10 mx-auto max-w-7xl px-4 pb-28 pt-32 sm:px-8">
    <nav hidden={inSchoolMode} aria-label="Study navigation" className="study-tabs mb-6 flex gap-2">
      {sections.map(([id,label]) => <button key={id} aria-current={section === id ? "page" : undefined} className={cx("workspace-tab", section === id && "selected")} onClick={() => setSection(id)}>{label}</button>)}
    </nav>
    <header hidden={!inSchoolMode&&section==="learning"} className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{inSchoolMode ? ({home:"Your dashboard",school:"School",classes:"Your classes"}[workspaceMode]||"Your dashboard") : section === "today" ? "Study mode" : sections.find(([id]) => id === section)?.[1]}</h1><p className="mt-2 text-sm text-white/65">{inSchoolMode ? "A place to start, see what’s due and find your classes." : "Your timer, tasks and study tools, together."}</p></div>

    </header>
    <div hidden={inSchoolMode} className="study-mode-content">
    {!inSchoolMode&&section==="learning"&&<LearningWorkspace user={currentUser} schoolAccount={schoolAccount}/>}
    <div hidden={section !== "today"}>
          <div className="next-step rounded-3xl border border-purple-200/25 p-6 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-200">Start here</p><h2 className="mt-3 text-2xl font-bold">{upcoming[0]?.name || "Make room for your next idea"}</h2><p className="mt-2 text-sm text-white/70">{upcoming[0] ? (upcoming[0].dueDate ? "Due " + upcoming[0].dueDate + " · Choose a small goal and give it your focus." : "Pick one small step to work on during your next focus session.") : "Add a task, then set aside a little time to work on it."}</p>
            <div className="mt-5 flex flex-wrap gap-3">{!upcoming.length&&<button className="workspace-primary" onClick={() => setSection("tasks")}>Add your first task</button>}<button className="workspace-secondary" onClick={() => setView("planner")}>Plan my study time</button></div>
          </div>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Your study modules</h2><button className="workspace-secondary" aria-pressed={moduleEditOpen} onClick={() => setModuleEditOpen(!moduleEditOpen)}>{moduleEditOpen ? "Finish editing" : "Edit modules"}</button></div>
      {moduleEditOpen && <p className="mb-4 text-sm text-white/60">Add or remove modules. On wider screens, drag the corners to resize them.</p>}
      <div className="custom-widget-board"><CenterPage personalTaskPanel={personalTaskPanel} tasks={tasks} setTasks={setTasks} customizeOpen={false} moduleEditOpen={moduleEditOpen} modules={modules} setModules={setModules} setView={setView} completedFocusMinutes={completedFocusMinutes} setCompletedFocusMinutes={setCompletedFocusMinutes} setStudyPeriods={setStudyPeriods} onTaskCreated={onTaskCreated} onPomodoroComplete={onPomodoroComplete} getActivitySnapshot={getActivitySnapshot} /></div>
      {modules.length === 0 && <p className="workspace-card">Your study space is empty. Choose Edit modules, then Add Modules to choose your tools.</p>}
    </div>
    <div hidden={section !== "tasks"} className="workspace-card">{personalTaskPanel}</div>
    <div hidden={section !== "calendar"} className="workspace-card"><WeeklyCalendar tasks={tasks} /></div>
    {!inSchoolMode && section === "today" && moduleEditOpen && <ModulesAddBar modules={modules} setModules={setModules} />}
    </div>
    {workspaceMode==="home"&&<section className="workspace-card dashboard-task-overview"><header className="assignment-header"><h2>Your tasks</h2><button className="workspace-secondary" onClick={()=>setWorkspaceMode("todo")}>Personal to-do list</button></header><p>{dashboardTasks.length} tasks to work on</p>{dashboardTasks.slice(0,5).map(t=><div className="assignment-deadline" key={t.id}><div><strong>{t.name}</strong><p>{t.schoolAssignmentId?"School assignment":"Personal task"} · {t.dueDate?"Due "+t.dueDate:"No deadline"}</p></div><button className="workspace-secondary" onClick={()=>setWorkspaceMode(t.schoolAssignmentId?"school":"todo")}>View</button></div>)}{!dashboardTasks.length&&<p>Your tasks will appear here. Add a personal task{schoolAccount?" or join a class":""} to get started.</p>}</section>}
    {schoolAccount&&<div hidden={!inSchoolMode}>{currentUser ? <LiveStudent notificationTarget={notificationTarget} destination={workspaceMode} key={homeRequest} school={liveSchool} personalTasks={personalTasks} onStudy={() => { setSection("learning"); setWorkspaceMode("personal"); }} onPersonalTasks={() => { setSection("tasks"); setWorkspaceMode("todo"); }} /> : <StudentSchoolSpace destination={workspaceMode} viewer={schoolViewer} homeRequest={homeRequest} personalTasks={personalTasks} onStudy={() => { setSection("learning"); setWorkspaceMode("personal"); }} onPersonalTasks={() => { setSection("tasks"); setWorkspaceMode("todo"); }} />}</div>}
    {customizeOpen && <><button aria-label="Close appearance settings" className="fixed inset-0 z-30 bg-black/50" onClick={() => setCustomizeOpen(false)} /><CustomizeDrawer theme={theme} setTheme={setTheme} /><button className="fixed right-8 top-28 z-50 workspace-secondary" onClick={() => setCustomizeOpen(false)}>Done</button></>}
  </section>;
}

export default function App() {
  const [workspaceMode,setWorkspaceMode]=useState("home");
  const [teacherDestination,setTeacherDestination]=useState("home"),[navigationRole,setNavigationRole]=useState("student");
  const [behaviourClassId,setBehaviourClassId]=useState(null);
  const [theme, setTheme] = useLocalCacheState("theme", defaultTheme);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [deviceDark, setDeviceDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => { const query = window.matchMedia("(prefers-color-scheme: dark)"); const update = event => setDeviceDark(event.matches); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  const appliedTheme = resolveTheme(theme, deviceDark);
  useEffect(() => { const previous = document.documentElement.style.fontSize; document.documentElement.style.fontSize = `${Number(theme.textScale) || 100}%`; return () => { document.documentElement.style.fontSize = previous; }; }, [theme.textScale]);
  const [view, setView] = useLocalCacheState("siteView", "home");
  const [accountRole,setAccountRole]=useState(null);
  const [schoolAccount,setSchoolAccount]=useState(false);
  const [streakAdmin,setStreakAdmin]=useState(false);
  const [accountError,setAccountError]=useState("");
  const [accountRetry,setAccountRetry]=useState(0);
  useEffect(()=>{if(accountRole==="teacher"||view==="teacher"||view==="gradebook")setNavigationRole("teacher");else if(view==="dashboard")setNavigationRole("student");},[view,accountRole]);
  const [currentUser, setCurrentUser] = useState(null);
  const {features:schoolFeatures}=useSchoolFeatures(schoolAccount ? currentUser : null);
  const [notificationTarget,setNotificationTarget]=useState(null);

  useEffect(()=>{if(readLocalCache("devBypassLogin",false)){setDevBypass(false);setSchoolRole(null);setNavigationRole("student");setView("login");}},[]);
  const [authReady, setAuthReady] = useState(!firebaseReady);
  const [devBypass, setDevBypass] = useLocalCacheState("devBypassLogin", false);
  const [schoolRole, setSchoolRole] = useLocalCacheState("sampleSchoolRole", null);
  const [personalLogin, setPersonalLogin] = useState(false);
  const [viewedProfile, setViewedProfile] = useState(null);
  const { profile, setProfile } = useUserProfile(currentUser, devBypass);
  const [completedFocusMinutes, setCompletedFocusMinutes] = useLocalCacheState("completedFocusMinutes", 0);
  const [studyPeriods, setStudyPeriods] = useLocalCacheState("studyPeriods", 0);
  const [tasksMade, setTasksMade] = useLocalCacheState("tasksMade", 0);
  const [longestStreakOverride, setLongestStreakOverride] = useLocalCacheState("longestStreakOverride", 0);
  const [studyLog] = useLocalCacheState("studyLog", {});
  const [equippedAchievementId, setEquippedAchievementId] = useLocalCacheState("equippedAchievementId", "");
  const [achievementNotifications, setAchievementNotifications] = useLocalCacheState("achievementNotifications", []);
  const [knownAchievementIds, setKnownAchievementIds] = useLocalCacheState("knownAchievementIds", []);
  const [selectedAchievementGroup, setSelectedAchievementGroup] = useState("");
  const [selectedAchievementId, setSelectedAchievementId] = useState("");
  const [achievementOrigin,setAchievementOrigin]=useState("achievements");
  const [specialBadges, setSpecialBadges] = useLocalCacheState("specialBadges", []);
  const [xpTotal, setXpTotal] = useLocalCacheState("xpTotal", 0);
  const [xpToday, setXpToday] = useLocalCacheState("xpToday", { date: todayKey(), value: 0 });
  const [dailyFocusXpMinutes, setDailyFocusXpMinutes] = useLocalCacheState("dailyFocusXpMinutes", {});
  const [dailyTaskXpCount, setDailyTaskXpCount] = useLocalCacheState("dailyTaskXpCount", {});
  const [xpEvents, setXpEvents] = useLocalCacheState("xpEvents", []);
  const [studyDayHistory, setStudyDayHistory] = useLocalCacheState("studyDayHistory", {});
  const [farmingFlags, setFarmingFlags] = useLocalCacheState("farmingFlags", []);
  const [totalUserCount, setTotalUserCount] = useState(1);
  const activityRef = useRef({ interactions: 0, lastActivityAt: Date.now() });
  const streakPreview = calculateStudyStreak(studyLog, profile?.weekendsCount ?? true);
  const achievementStats = {
    completedFocusMinutes,
    studyPeriods,
    tasksMade,
    longestStreak: Math.max(streakPreview.longest, Number(profile?.longestStreak || 0), longestStreakOverride),
    xpTotal,
    specialBadges,
  };
  const isAdmin = streakAdmin || Number(profile?.userId) === 1;

  useEffect(() => {
    const recordActivity = () => {
      activityRef.current = {
        interactions: activityRef.current.interactions + 1,
        lastActivityAt: Date.now(),
      };
    };

    window.addEventListener("click", recordActivity);
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("pointerdown", recordActivity);
    return () => {
      window.removeEventListener("click", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("pointerdown", recordActivity);
    };
  }, []);

  const addXpEvent = (amount, event) => {
    const xp = Math.max(0, Math.round(Number(amount) || 0));
    const day = event.date || todayKey();
    if (xp <= 0) return;

    setXpTotal((current) => current + xp);
    setXpToday((current) => ({
      date: day,
      value: current?.date === day ? Number(current.value || 0) + xp : xp,
    }));
    setXpEvents((current) => [{ ...event, xp, date: day, createdAt: Date.now() }, ...current].slice(0, 200));
  };

  const evaluatePomodoroSuspicion = ({ workMinutes, restMinutes, startedAt, startInteractions, day }) => {
    const previousStudyDays = Object.entries(studyDayHistory || {}).filter(
      ([key, value]) => key !== day && Number(value?.completedBlocks || 0) > 0
    );
    if (previousStudyDays.length < 7) return { score: 0, flags: [], multiplier: 1 };

    const flags = [];
    let score = 0;
    const interactionCount = Math.max(0, activityRef.current.interactions - (Number(startInteractions) || 0));
    if (interactionCount < 2) {
      flags.push("Low interaction during block");
      score += 30;
    }

    const recentPomodoros = (xpEvents || []).filter((event) => event.type === "pomodoro").slice(0, 5);
    const recentSameBlocks = recentPomodoros.slice(0, 3).filter((event) => Number(event.workMinutes) === Number(workMinutes)).length;
    if (recentSameBlocks >= 3) {
      flags.push("Many identical blocks in a row");
      score += 20;
    }

    const completedAt = Date.now();
    const skippedBreaks = recentPomodoros
      .slice(0, 3)
      .filter((event) => completedAt - Number(event.completedAt || event.createdAt || 0) < Math.max(1, Number(restMinutes) || 1) * 60 * 1000 * 0.75).length;
    if (skippedBreaks >= 2) {
      flags.push("Breaks skipped repeatedly");
      score += 20;
    }

    const normalAverage = getTrimmedAverage(previousStudyDays.map(([, value]) => Number(value?.minutes || 0)));
    const todayMinutes = Number(studyDayHistory?.[day]?.minutes || 0) + Number(workMinutes || 0);
    if (normalAverage > 0 && todayMinutes > Math.max(normalAverage * 1.8, normalAverage + 45)) {
      flags.push("Today is unusually above your normal study average");
      score += 30;
    }

    if (Number(startedAt) && completedAt - Number(startedAt) < Math.max(1, Number(workMinutes) || 1) * 60 * 1000 * 0.75) {
      flags.push("Block completed too quickly");
      score += 25;
    }

    return {
      score,
      flags,
      multiplier: score >= 85 ? 0 : score >= 60 ? 0.3 : 1,
    };
  };

  const awardPomodoroXp = ({ workMinutes, restMinutes, startedAt, startInteractions }) => {
    const day = todayKey();
    const safeWorkMinutes = Math.max(1, Number(workMinutes) || 1);
    const usedFocusMinutes = Number(dailyFocusXpMinutes?.[day] || 0);
    const fullMinutes = Math.min(safeWorkMinutes, Math.max(0, 240 - usedFocusMinutes));
    const reducedMinutes = Math.min(Math.max(0, safeWorkMinutes - fullMinutes), Math.max(0, 300 - Math.max(240, usedFocusMinutes)));
    const xpEligibleMinutes = fullMinutes + reducedMinutes;
    const baseXp = fullMinutes * 2 + reducedMinutes * 0.5 + (xpEligibleMinutes > 0 ? 10 : 0);
    const suspicion = evaluatePomodoroSuspicion({ workMinutes: safeWorkMinutes, restMinutes, startedAt, startInteractions, day });
    const earnedXp = baseXp * suspicion.multiplier;

    setDailyFocusXpMinutes((current) => ({
      ...current,
      [day]: Math.min(300, Number(current?.[day] || 0) + xpEligibleMinutes),
    }));
    setStudyDayHistory((current) => {
      const today = current?.[day] || {};
      return {
        ...current,
        [day]: {
          ...today,
          minutes: Number(today.minutes || 0) + safeWorkMinutes,
          completedBlocks: Number(today.completedBlocks || 0) + 1,
          xp: Number(today.xp || 0) + Math.round(earnedXp),
          lastStudyAt: Date.now(),
        },
      };
    });
    if (suspicion.flags.length) {
      setFarmingFlags((current) => [
        { date: day, createdAt: Date.now(), score: suspicion.score, flags: suspicion.flags },
        ...current.filter((flag) => Date.now() - Number(flag.createdAt || 0) < 7 * 24 * 60 * 60 * 1000),
      ].slice(0, 30));
    }
    addXpEvent(earnedXp, {
      type: "pomodoro",
      workMinutes: safeWorkMinutes,
      restMinutes,
      completedAt: Date.now(),
      baseXp,
      suspicionScore: suspicion.score,
      flags: suspicion.flags,
    });
  };

  const awardTaskXp = () => {
    setTasksMade((current) => current + 1);
    const day = todayKey();
    const taskCount = Number(dailyTaskXpCount?.[day] || 0);
    if (taskCount >= 10) return;
    setDailyTaskXpCount((current) => ({ ...current, [day]: Number(current?.[day] || 0) + 1 }));
    addXpEvent(5, { type: "task", taskNumber: taskCount + 1 });
  };

  useEffect(() => {
    let cancelled = false;
    const fallbackCount = Math.max(1, Number(profile?.userId || 0), Number(viewedProfile?.userId || 0), ALEXANDER_PROFILE.userId);

    const loadTotalUsers = async () => {
      if (!db) {
        setTotalUserCount(fallbackCount);
        return;
      }

      try {
        const counter = await getDoc(doc(db, "metadata", "userCounter"));
        const nextId = Number(counter.data()?.nextId || 0);
        if (!cancelled) setTotalUserCount(Math.max(fallbackCount, nextId > 0 ? nextId - 1 : 0));
      } catch {
        if (!cancelled) setTotalUserCount(fallbackCount);
      }
    };

    loadTotalUsers();
    return () => {
      cancelled = true;
    };
  }, [profile?.userId, viewedProfile?.userId]);

  useEffect(() => {
    const unlocked = getUnlockedAchievements(achievementStats);
    const known = new Set(knownAchievementIds);
    const fresh = unlocked.filter((achievement) => !known.has(achievement.id));
    if (!fresh.length) return;

    setKnownAchievementIds(unlocked.map((achievement) => achievement.id));
    setAchievementNotifications((current) => [
      ...fresh.map((achievement) => ({ ...achievement, unlockedAt: Date.now() })),
      ...current,
    ].slice(0, 20));
  }, [completedFocusMinutes, studyPeriods, tasksMade, achievementStats.longestStreak, xpTotal, specialBadges]);

  useEffect(() => {
    if (!auth) return undefined;
    let generation=0;
    const unsubscribe=onAuthStateChanged(auth, async user => {
      const request=++generation;
      setCurrentUser(user);setSchoolAccount(false);setAccountRole(null);setStreakAdmin(false);setAccountError("");
      if(!user){setAuthReady(true);return;}
      setAuthReady(false);setDevBypass(false);setSchoolRole(null);
      try {
        const shared=await syncCommunityUser(user);
        if(request!==generation)return;
        const role=shared.accountRole;
        if(!["teacher","student","sysadmin"].includes(role))throw new Error("Your account workspace could not be loaded.");
        setSchoolAccount(shared.accountType==="school"&&!!shared.schoolId);setAccountRole(role);setStreakAdmin(shared.streakAdmin===true);setNavigationRole(role);setWorkspaceMode("home");setTeacherDestination("home");
        setView(shared.accountType==="school"?(role==="sysadmin"?"schooladmin":role==="teacher"?"teacher":"dashboard"):"dashboard");setAuthReady(true);
      } catch(error){if(request===generation)setAccountError(error.message||"Could not load your workspace. Please try again.");}
    });
    return ()=>{generation++;unsubscribe();};
  }, [accountRetry]);

  const clearWorkspace = (personal = false) => {
    setDevBypass(false);setSchoolRole(null);setNavigationRole("student");
    setWorkspaceMode("home");setTeacherDestination("home");setBehaviourClassId(null);
    setViewedProfile(null);setNotificationTarget(null);setPersonalLogin(personal);setView("login");
  };
  const beginSignIn = () => clearWorkspace(true);
  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setCurrentUser(null);
    setAccountRole(null);setAccountError("");
    clearWorkspace();
  };

  const dismissAchievementNotification = (notification) => {
    setAchievementNotifications((current) =>
      current.filter((item) => !(item.id === notification.id && item.unlockedAt === notification.unlockedAt))
    );
  };

  const openAchievementFromNotification = (notification) => {
    dismissAchievementNotification(notification);
    setAchievementOrigin(view==="profile"?"profile":"achievements");
    setSelectedAchievementGroup(notification.groupKey);
    setSelectedAchievementId(notification.id);
    setView("achievements");
  };

  const openAchievementDetail = (achievement) => {
    setAchievementOrigin("profile");
    setSelectedAchievementGroup(achievement.groupKey);
    setSelectedAchievementId(achievement.id);
    setView("achievements");
  };

  const demoRole = import.meta.env.DEV && devBypass ? schoolRole : null;
  const hasAccess = Boolean(currentUser || devBypass);
  const sessionUser = currentUser || (devBypass ? { uid: "dev-bypass-alexander" } : null);
  const teacherLocked=currentUser?schoolAccount&&["teacher","sysadmin"].includes(accountRole):demoRole==="teacher";
  const chooseStudentMode=mode=>{if(currentUser&&!schoolAccount&&mode==="personal")mode="home";if(currentUser&&!schoolAccount&&!["home","personal","todo","achievements","settings"].includes(mode)){setWorkspaceMode("home");setView("dashboard");return;}setNotificationTarget(null);if(teacherLocked){setView("teacher");return;}setNavigationRole("student");if(mode==="achievements"){setSelectedAchievementId("");setAchievementOrigin("achievements");setView("achievements");return;}if(mode==='resources'){setView('resources');return;}if(mode==='behaviour'){setView("behaviour");return;}if(mode==='settings'){setView("settings");return;}setWorkspaceMode(mode);setView("dashboard");if(mode==='home')window.dispatchEvent(new Event('student-home'));if(mode==='personal')window.dispatchEvent(new Event('student-study'));};
  const chooseTeacherPage=page=>{setNotificationTarget(null);setNavigationRole("teacher");setBehaviourClassId(null);if(page==='resources'){setView('resources');return;}if(page==="behaviour"){setView("behaviour");return;}if(page==="settings"){setView("settings");return;}if(page==="gradebook"){setView("gradebook");return;}setTeacherDestination(page);setView("teacher");};
  const activeView = resolveWorkspaceView({view,authReady,hasAccess,teacherLocked,sysadmin:!!currentUser&&schoolAccount&&accountRole==="sysadmin",schoolAccount:schoolAccount||!!demoRole});

  return (
    <MotionConfig reducedMotion={theme.reduceMotion ? "always" : "user"}><main data-reading-space={String(Boolean(theme.readingSpace))} data-large-controls={String(Boolean(theme.largeControls))} data-reduce-motion={String(Boolean(theme.reduceMotion))} data-theme={appliedTheme.palette} data-glass={String(appliedTheme.glassEnabled)} className="themed-app relative min-h-screen overflow-hidden font-sans text-white" style={buildThemeVars(appliedTheme)}>
      <AppBackground theme={appliedTheme} />
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_center,transparent_0,color-mix(in_srgb,var(--pc-base)_35%,transparent)_72%)]" />
      <CommunityAccountSync user={currentUser} />
      {currentUser?.providerData?.some(provider=>provider.providerId !== "password") && <ExternalAccountSetup key={currentUser.uid} user={currentUser} onComplete={shared=>{
        const next={...readLocalCache(`pendingProfile:${currentUser.uid}`,{}),uid:currentUser.uid,username:shared.username,studyLocation:shared.studyLocation,profileVisibility:shared.profileVisibility};
        writeLocalCache(`pendingProfile:${currentUser.uid}`,next);setProfile(current=>({...current,...next}));
      }}/>}
      {demoRole ? <SchoolDemoNav  role={demoRole} onHome={() => { setTeacherDestination("home");setWorkspaceMode("home");window.dispatchEvent(new Event("student-home")); setView(demoRole === "teacher" ? "teacher" : "dashboard"); }} onAppearance={() => setAccessibilityOpen(true)} onSwitch={()=>clearWorkspace()} /> : <SiteNav
        authUser={schoolAccount?currentUser:null}
        onSchoolNotification={notification=>{if(!schoolAccount)return;setNotificationTarget({...notification,nonce:crypto.randomUUID()});setBehaviourClassId(null);if(accountRole==='teacher'){setTeacherDestination('classes');setView('teacher');}else{setWorkspaceMode(notification.post_id?'classes':'school');setView('dashboard');}}}
        onTeacherHome={()=>{setNotificationTarget(null);setTeacherDestination("home");setBehaviourClassId(null);}}
        teacherLocked={teacherLocked}
        view={activeView}
        setView={next=>{if(next==="achievements"){setSelectedAchievementId("");setAchievementOrigin("achievements");}setView(next);}}
        currentUser={authReady&&hasAccess}
        profile={profile}
        onLogout={handleLogout}
        onOwnProfile={() => setViewedProfile(null)}
        achievementNotifications={achievementNotifications}
        isAdmin={isAdmin}
        onDismissAchievementNotification={dismissAchievementNotification}
        onOpenAchievementNotification={openAchievementFromNotification}
      />}

      {currentUser&&schoolAccount&&accountRole==="sysadmin"&&["schooladmin","settings","resources"].includes(activeView)?<StudentSidebar role="sysadmin" active={["settings","resources"].includes(activeView)?activeView:teacherDestination} onNavigate={page=>{if(["settings","resources"].includes(page))setView(page);else{setTeacherDestination(page);setView("schooladmin");}}}/>:(hasAccess&&(["schooladmin","dashboard","teacher","gradebook","settings","behaviour","resources"].includes(activeView)||(activeView==="achievements"&&!teacherLocked&&accountRole!=="sysadmin"))&&<StudentSidebar behaviourEnabled={schoolFeatures?.mode!=='disabled'||!!schoolFeatures?.shopEnabled} role={currentUser&&!schoolAccount?"personal":teacherLocked?"teacher":activeView==="teacher"||activeView==="gradebook"?"teacher":activeView==="dashboard"?"student":navigationRole} demo={!!demoRole} active={["settings","behaviour","gradebook","resources","achievements"].includes(activeView)?activeView:activeView==="teacher"?teacherDestination:workspaceMode} onNavigate={currentUser&&!schoolAccount?chooseStudentMode:teacherLocked||activeView==="teacher"||activeView==="gradebook"||["settings","behaviour","resources"].includes(activeView)&&navigationRole==="teacher"?chooseTeacherPage:chooseStudentMode}/>)}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="relative z-10 min-h-screen"
        >
          {!authReady && (
            <section className="mx-auto flex min-h-screen max-w-md items-center px-8 pb-16 pt-36 text-white">
              <GlassPanel className="w-full p-7 text-center">
                <h2 className="text-2xl font-black tracking-tight">{accountError?"Workspace unavailable":"Checking your session"}</h2>
                <p className="mt-2 text-sm text-white/60" role={accountError?"alert":"status"}>{accountError||"Loading your workspace…"}</p>
                {accountError&&<div className="mt-4 flex gap-3"><button className="workspace-secondary" onClick={()=>setAccountRetry(value=>value+1)}>Try again</button><button className="workspace-secondary" onClick={handleLogout}>Sign out</button></div>}
              </GlassPanel>
            </section>
          )}
          {authReady && activeView === "home" && <HomePage setView={setView} />}
          {authReady && activeView === "pricing" && <PricingPage />}
          {authReady && activeView === "community" && (
            <CommunityPage currentUser={currentUser} />
          )}
          {authReady && activeView === "login" && (personalLogin ? <><LoginPage setView={setView} /><button className="school-personal-back workspace-secondary" onClick={() => setPersonalLogin(false)}>← School login</button></> : <SchoolEntry onPersonal={() => setPersonalLogin(true)} />)}
          {authReady && activeView === "resources" && <Resources user={currentUser}/>}
          {authReady && activeView === "behaviour" && <Behaviour user={currentUser} teacher={teacherLocked||navigationRole==="teacher"} onClass={id=>{setBehaviourClassId(id);setTeacherDestination("classes");setView("teacher");}} onSignIn={beginSignIn}/>}
          {authReady && activeView === "gradebook" && currentUser && <div className="workspace-rail-page"><Gradebook user={currentUser} onBack={()=>setView("teacher")} /></div>}
          {authReady && activeView === "schooladmin" && currentUser && <SchoolAdmin user={currentUser} page={teacherDestination} onNavigate={page=>{setTeacherDestination(page);setView("schooladmin");}}/>}
          {authReady && activeView === "teacher" && (currentUser ? <LiveTeacher notificationTarget={notificationTarget} user={currentUser} initialClassId={behaviourClassId} destination={teacherDestination} onNavigate={chooseTeacherPage} /> : demoRole === "teacher" ? <TeacherDashboard destination={teacherDestination} /> : <SchoolEntry onPersonal={beginSignIn} />)}
          {authReady && activeView === "planner" && <PlannerPage />}
          {authReady && activeView === "achievements" && (
            <AchievementsPage
              stats={achievementStats}
              initialOpenGroup={selectedAchievementGroup}
              selectedAchievementId={selectedAchievementId}
              setSelectedAchievementId={id=>{setAchievementOrigin("achievements");setSelectedAchievementId(id);}}
              detailOrigin={achievementOrigin}
              onBackFromDetail={()=>{setSelectedAchievementId("");if(achievementOrigin==="profile")setView("profile");setAchievementOrigin("achievements");}}
              totalUsers={totalUserCount}
            />
          )}
          {authReady && activeView === "admin" && isAdmin && (
            <AdminPanelPage
              completedFocusMinutes={completedFocusMinutes}
              setCompletedFocusMinutes={setCompletedFocusMinutes}
              studyPeriods={studyPeriods}
              setStudyPeriods={setStudyPeriods}
              tasksMade={tasksMade}
              setTasksMade={setTasksMade}
              longestStreakOverride={longestStreakOverride}
              setLongestStreakOverride={setLongestStreakOverride}
              achievementNotifications={achievementNotifications}
              setAchievementNotifications={setAchievementNotifications}
              setKnownAchievementIds={setKnownAchievementIds}
              specialBadges={specialBadges}
              setSpecialBadges={setSpecialBadges}
              xpTotal={xpTotal}
              setXpTotal={setXpTotal}
              setXpToday={setXpToday}
              setDailyFocusXpMinutes={setDailyFocusXpMinutes}
              setDailyTaskXpCount={setDailyTaskXpCount}
              setXpEvents={setXpEvents}
              setStudyDayHistory={setStudyDayHistory}
              setFarmingFlags={setFarmingFlags}
            />
          )}
          {authReady && activeView === "profile" && <ProfilePage currentUser={currentUser} profile={profile} setProfile={setProfile} viewedProfile={viewedProfile} achievementStats={achievementStats} equippedAchievementId={equippedAchievementId} onOpenAchievement={openAchievementDetail} />}
          {authReady && activeView === "settings" && <div className="workspace-rail-page"><SettingsPage onAppearance={()=>setAccessibilityOpen(true)} currentUser={currentUser} achievementStats={achievementStats} equippedAchievementId={equippedAchievementId} setEquippedAchievementId={setEquippedAchievementId} /></div>}
          {authReady && activeView === "dashboard" && (
            <DashboardApp
              schoolAccount={schoolAccount||!!demoRole}
              notificationTarget={notificationTarget}
              workspaceMode={workspaceMode}
              setWorkspaceMode={setWorkspaceMode}
              currentUser={currentUser}
              schoolDemo={demoRole === "student"}
              schoolViewer={demoRole === "student" ? DEMO_STUDENT : { id: currentUser?.uid || "personal-demo", name: currentUser?.displayName || profile?.username || "Personal student", demoAll: false }}
              theme={theme}
              setTheme={setTheme}
              setView={setView}
              completedFocusMinutes={completedFocusMinutes}
              setCompletedFocusMinutes={setCompletedFocusMinutes}
              setStudyPeriods={setStudyPeriods}
              onTaskCreated={awardTaskXp}
              onPomodoroComplete={awardPomodoroXp}
              getActivitySnapshot={() => activityRef.current}
            />
          )}
        </motion.div>
      </AnimatePresence>
      {!["schooladmin","dashboard","teacher","gradebook","settings","behaviour","resources"].includes(activeView) && !demoRole && <button className="fixed bottom-4 right-4 z-50 workspace-secondary" onClick={() => setAccessibilityOpen(!accessibilityOpen)}>Appearance &amp; accessibility</button>}
      {accessibilityOpen && <><button aria-label="Close appearance settings" className="fixed inset-0 z-30 bg-black/50" onClick={() => setAccessibilityOpen(false)} /><CustomizeDrawer theme={theme} setTheme={setTheme} /><button className="fixed right-8 top-28 z-50 workspace-secondary" onClick={() => setAccessibilityOpen(false)}>Done</button></>}
    </main></MotionConfig>
  );
}





