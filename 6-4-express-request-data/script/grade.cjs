#!/usr/bin/env node

/**
 * Lab Autograder — 6-4 Express Request Data
 *
 * Grades ONLY based on the lab's TODOs / setup items:
 *  - server.js
 *
 * Marking:
 * - 80 marks for lab TODOs / structure
 * - 20 marks for submission timing
 *   - On/before deadline => 20/20
 *   - After deadline     => 10/20
 *
 * Deadline: 08 Apr 2026 20:59 (Asia/Riyadh, UTC+03:00)
 *
 * Repo layout expected:
 * - repo root may be the project itself OR may contain the project folder
 * - project folder: 6-4-express-request-data-main/
 * - app folder:     6-4-express-request-data-main/6-4-express-request-data/
 * - grader file:    6-4-express-request-data-main/6-4-express-request-data/scripts/grade.cjs
 * - student file:
 *      6-4-express-request-data-main/6-4-express-request-data/server.js
 *
 * Notes:
 * - Ignores JS comments (starter TODO comments do NOT count).
 * - npm install commands are NOT graded.
 * - Manual testing steps are NOT graded.
 * - Port 3000 is NOT graded (some systems may not allow it).
 * - Grading is intentionally lenient and checks top-level implementation only.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ARTIFACTS_DIR = "artifacts";
const FEEDBACK_DIR = path.join(ARTIFACTS_DIR, "feedback");
fs.mkdirSync(FEEDBACK_DIR, { recursive: true });

/* -----------------------------
   Deadline (Asia/Riyadh)
   08 Apr 2026, 20:59
-------------------------------- */
const DEADLINE_RIYADH_ISO = "2026-04-08T20:59:00+03:00";
const DEADLINE_MS = Date.parse(DEADLINE_RIYADH_ISO);

// Submission marks policy
const SUBMISSION_MAX = 20;
const SUBMISSION_LATE = 10;

/* -----------------------------
   TODO marks (out of 80)
-------------------------------- */
const tasks = [
  { id: "t1", name: "TODO 1: Server setup in server.js", marks: 15 },
  { id: "t2", name: "TODO 2: Implement GET /echo using req.query", marks: 20 },
  { id: "t3", name: "TODO 3: Implement GET /profile/:first/:last using req.params", marks: 15 },
  { id: "t4", name: 'TODO 4: Implement app.param("userId") middleware', marks: 15 },
  { id: "t5", name: "TODO 5: Implement GET /users/:userId route", marks: 15 },
];

const STEPS_MAX = tasks.reduce((sum, t) => sum + t.marks, 0); // 80
const TOTAL_MAX = STEPS_MAX + SUBMISSION_MAX; // 100

/* -----------------------------
   Helpers
-------------------------------- */
function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function mdEscape(s) {
  return String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function splitMarks(stepMarks, missingCount, totalChecks) {
  if (missingCount <= 0) return stepMarks;
  const perItem = stepMarks / totalChecks;
  const deducted = perItem * missingCount;
  return Math.max(0, round2(stepMarks - deducted));
}

/**
 * Strip JS comments while trying to preserve strings/templates.
 */
function stripJsComments(code) {
  if (!code) return code;

  let out = "";
  let i = 0;

  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];

    if (!inDouble && !inTemplate && ch === "'" && !inSingle) {
      inSingle = true;
      out += ch;
      i++;
      continue;
    }
    if (inSingle && ch === "'") {
      let backslashes = 0;
      for (let k = i - 1; k >= 0 && code[k] === "\\"; k--) backslashes++;
      if (backslashes % 2 === 0) inSingle = false;
      out += ch;
      i++;
      continue;
    }

    if (!inSingle && !inTemplate && ch === '"' && !inDouble) {
      inDouble = true;
      out += ch;
      i++;
      continue;
    }
    if (inDouble && ch === '"') {
      let backslashes = 0;
      for (let k = i - 1; k >= 0 && code[k] === "\\"; k--) backslashes++;
      if (backslashes % 2 === 0) inDouble = false;
      out += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && ch === "`" && !inTemplate) {
      inTemplate = true;
      out += ch;
      i++;
      continue;
    }
    if (inTemplate && ch === "`") {
      let backslashes = 0;
      for (let k = i - 1; k >= 0 && code[k] === "\\"; k--) backslashes++;
      if (backslashes % 2 === 0) inTemplate = false;
      out += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === "/" && next === "/") {
        i += 2;
        while (i < code.length && code[i] !== "\n") i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        i += 2;
        while (i < code.length) {
          if (code[i] === "*" && code[i + 1] === "/") {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}

function existsFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function existsDir(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function hasAny(text, patterns) {
  return patterns.some((p) => p.test(text));
}

/* -----------------------------
   Project root detection
-------------------------------- */
const REPO_ROOT = process.cwd();

function isAppFolder(p) {
  try {
    return (
      fs.existsSync(path.join(p, "package.json")) &&
      fs.existsSync(path.join(p, "server.js"))
    );
  } catch {
    return false;
  }
}

function pickProjectRoot(cwd) {
  if (isAppFolder(cwd)) return cwd;

  const preferred = path.join(cwd, "6-4-express-request-data");
  if (isAppFolder(preferred)) return preferred;

  const preferredNested = path.join(cwd, "6-4-express-request-data-main", "6-4-express-request-data");
  if (isAppFolder(preferredNested)) return preferredNested;

  let subs = [];
  try {
    subs = fs
      .readdirSync(cwd, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    subs = [];
  }

  for (const name of subs) {
    const p = path.join(cwd, name);
    if (isAppFolder(p)) return p;

    const nested = path.join(p, "6-4-express-request-data");
    if (isAppFolder(nested)) return nested;
  }

  return cwd;
}

const PROJECT_ROOT = pickProjectRoot(REPO_ROOT);

/* -----------------------------
   Find files
-------------------------------- */
const serverFile = path.join(PROJECT_ROOT, "server.js");

/* -----------------------------
   Determine submission time
-------------------------------- */
let lastCommitISO = null;
let lastCommitMS = null;

try {
  lastCommitISO = execSync("git log -1 --format=%cI", { encoding: "utf8" }).trim();
  lastCommitMS = Date.parse(lastCommitISO);
} catch {
  lastCommitISO = new Date().toISOString();
  lastCommitMS = Date.now();
}

/* -----------------------------
   Submission marks
-------------------------------- */
const isLate = Number.isFinite(lastCommitMS) ? lastCommitMS > DEADLINE_MS : true;
const submissionScore = isLate ? SUBMISSION_LATE : SUBMISSION_MAX;

/* -----------------------------
   Load & strip student file
-------------------------------- */
const serverRaw = existsFile(serverFile) ? safeRead(serverFile) : null;
const serverCode = serverRaw ? stripJsComments(serverRaw) : null;

const results = [];

/* -----------------------------
   Result helpers
-------------------------------- */
function addResult(task, required) {
  const missing = required.filter((r) => !r.ok);
  const score = splitMarks(task.marks, missing.length, required.length);

  results.push({
    id: task.id,
    name: task.name,
    max: task.marks,
    score,
    checklist: required.map((r) => `${r.ok ? "✅" : "❌"} ${r.label}`),
    deductions: missing.length ? missing.map((m) => `Missing: ${m.label}`) : [],
  });
}

function failTask(task, reason) {
  results.push({
    id: task.id,
    name: task.name,
    max: task.marks,
    score: 0,
    checklist: [],
    deductions: [reason],
  });
}

/* -----------------------------
   Grade TODOs
-------------------------------- */

/**
 * TODO 1 — Server setup
 * Port value itself is NOT graded.
 */
{
  if (!serverCode) {
    failTask(tasks[0], "server.js not found / unreadable.");
  } else {
    const required = [
      {
        label: 'Imports express using import express from "express"',
        ok: /import\s+express\s+from\s+['"]express['"]/i.test(serverCode),
      },
      {
        label: "Creates the Express app using const app = express()",
        ok: /const\s+app\s*=\s*express\s*\(\s*\)/i.test(serverCode),
      },
      {
        label: "Starts the server using app.listen(...)",
        ok: /app\.listen\s*\(/i.test(serverCode),
      },
      {
        label: 'Logs startup message containing "API running at"',
        ok: /console\.log\s*\(\s*['"`][\s\S]*API running at[\s\S]*['"`]\s*\)/i.test(serverCode),
      },
    ];

    addResult(tasks[0], required);
  }
}

/**
 * TODO 2 — GET /echo
 */
{
  if (!serverCode) {
    failTask(tasks[1], "server.js not found / unreadable.");
  } else {
    const required = [
      {
        label: 'Defines GET route app.get("/echo", ...)',
        ok: /app\.get\s*\(\s*['"]\/echo['"]\s*,/i.test(serverCode),
      },
      {
        label: "Reads query params from req.query",
        ok: hasAny(serverCode, [
          /req\.query/i,
          /const\s*\{\s*name\s*,\s*age\s*\}\s*=\s*req\.query/i,
        ]),
      },
      {
        label: 'Checks for missing name or age and returns status 400',
        ok: /\/echo[\s\S]*?(?:!\s*name\s*\|\|\s*!\s*age|!\s*age\s*\|\|\s*!\s*name|name\s*==\s*null|age\s*==\s*null)[\s\S]*?res\.status\s*\(\s*400\s*\)/i.test(serverCode),
      },
      {
        label: 'Returns error JSON with ok:false and "name & age required"',
        ok: /\/echo[\s\S]*?res\.(?:status\s*\(\s*400\s*\)\s*\.)?json\s*\(\s*\{[\s\S]*ok\s*:\s*false[\s\S]*error\s*:\s*['"]name\s*&\s*age\s*required['"][\s\S]*\}\s*\)/i.test(serverCode),
      },
      {
        label: "Returns success JSON with ok:true and includes name/age/msg",
        ok: /\/echo[\s\S]*?res\.json\s*\(\s*\{[\s\S]*ok\s*:\s*true[\s\S]*name[\s\S]*age[\s\S]*msg[\s\S]*\}\s*\)/i.test(serverCode),
      },
    ];

    addResult(tasks[1], required);
  }
}

/**
 * TODO 3 — GET /profile/:first/:last
 */
{
  if (!serverCode) {
    failTask(tasks[2], "server.js not found / unreadable.");
  } else {
    const required = [
      {
        label: 'Defines GET route app.get("/profile/:first/:last", ...)',
        ok: /app\.get\s*\(\s*['"]\/profile\/:first\/:last['"]\s*,/i.test(serverCode),
      },
      {
        label: "Reads first and last from req.params",
        ok: hasAny(serverCode, [
          /req\.params/i,
          /const\s*\{\s*first\s*,\s*last\s*\}\s*=\s*req\.params/i,
        ]),
      },
      {
        label: 'Returns JSON with ok:true and fullName',
        ok: /\/profile\/:first\/:last[\s\S]*?res\.json\s*\(\s*\{[\s\S]*ok\s*:\s*true[\s\S]*fullName[\s\S]*\}\s*\)/i.test(serverCode),
      },
    ];

    addResult(tasks[2], required);
  }
}

/**
 * TODO 4 — app.param("userId")
 */
{
  if (!serverCode) {
    failTask(tasks[3], "server.js not found / unreadable.");
  } else {
    const required = [
      {
        label: 'Defines app.param("userId", ...)',
        ok: /app\.param\s*\(\s*['"]userId['"]\s*,/i.test(serverCode),
      },
      {
        label: "Converts userId to a number",
        ok: /app\.param\s*\(\s*['"]userId['"]\s*,[\s\S]*?(Number\s*\(\s*userId\s*\)|parseInt\s*\(\s*userId\s*,?\s*10?\s*\)|\+\s*userId)/i.test(serverCode),
      },
      {
        label: 'Rejects invalid/non-positive userId with status 400 JSON error',
        ok: /app\.param\s*\(\s*['"]userId['"]\s*,[\s\S]*?res\.status\s*\(\s*400\s*\)[\s\S]*?json\s*\(\s*\{[\s\S]*ok\s*:\s*false[\s\S]*error\s*:\s*['"]userId must be positive number['"][\s\S]*\}\s*\)/i.test(serverCode),
      },
      {
        label: "Stores numeric value in req.userIdNum and calls next()",
        ok: /app\.param\s*\(\s*['"]userId['"]\s*,[\s\S]*?req\.userIdNum\s*=[\s\S]*?next\s*\(\s*\)/i.test(serverCode),
      },
    ];

    addResult(tasks[3], required);
  }
}

/**
 * TODO 5 — GET /users/:userId
 */
{
  if (!serverCode) {
    failTask(tasks[4], "server.js not found / unreadable.");
  } else {
    const required = [
      {
        label: 'Defines GET route app.get("/users/:userId", ...)',
        ok: /app\.get\s*\(\s*['"]\/users\/:userId['"]\s*,/i.test(serverCode),
      },
      {
        label: "Uses req.userIdNum in the route response",
        ok: /\/users\/:userId[\s\S]*?req\.userIdNum/i.test(serverCode),
      },
      {
        label: "Returns JSON with ok:true and userId",
        ok: /\/users\/:userId[\s\S]*?res\.json\s*\(\s*\{[\s\S]*ok\s*:\s*true[\s\S]*userId[\s\S]*\}\s*\)/i.test(serverCode),
      },
    ];

    addResult(tasks[4], required);
  }
}

/* -----------------------------
   Final scoring
-------------------------------- */
const stepsScore = results.reduce((sum, r) => sum + r.score, 0);
const totalScore = round2(stepsScore + submissionScore);

/* -----------------------------
   Build summary + feedback
-------------------------------- */
const LAB_NAME = "6-4-express-request-data-main";

const submissionLine = `- **Lab:** ${LAB_NAME}
- **Deadline (Riyadh / UTC+03:00):** ${DEADLINE_RIYADH_ISO}
- **Last commit time (from git log):** ${lastCommitISO}
- **Submission marks:** **${submissionScore}/${SUBMISSION_MAX}** ${isLate ? "(Late submission)" : "(On time)"}
`;

let summary = `# ${LAB_NAME} — Autograding Summary

## Submission

${submissionLine}

## Files Checked

- Repo root (cwd): ${REPO_ROOT}
- Detected project root: ${PROJECT_ROOT}
- Server: ${existsFile(serverFile) ? `✅ ${serverFile}` : "❌ server.js not found"}

## Marks Breakdown

| Component | Marks |
|---|---:|
`;

for (const r of results) summary += `| ${r.name} | ${r.score}/${r.max} |\n`;
summary += `| Submission (timing) | ${submissionScore}/${SUBMISSION_MAX} |\n`;

summary += `
## Total Marks

**${totalScore} / ${TOTAL_MAX}**

## Detailed Checks (What you did / missed)
`;

for (const r of results) {
  const done = (r.checklist || []).filter((x) => x.startsWith("✅"));
  const missed = (r.checklist || []).filter((x) => x.startsWith("❌"));

  summary += `
<details>
  <summary><strong>${mdEscape(r.name)}</strong> — ${r.score}/${r.max}</summary>

  <br/>

  <strong>✅ Found</strong>
  ${done.length ? "\n" + done.map((x) => `- ${mdEscape(x)}`).join("\n") : "\n- (Nothing detected)"}

  <br/><br/>

  <strong>❌ Missing</strong>
  ${missed.length ? "\n" + missed.map((x) => `- ${mdEscape(x)}`).join("\n") : "\n- (Nothing missing)"}

  <br/><br/>

  <strong>❗ Deductions / Notes</strong>
  ${
    r.deductions && r.deductions.length
      ? "\n" + r.deductions.map((d) => `- ${mdEscape(d)}`).join("\n")
      : "\n- No deductions."
  }

</details>
`;
}

summary += `
> Full feedback is also available in: \`artifacts/feedback/README.md\`
`;

let feedback = `# ${LAB_NAME} — Feedback

## Submission

${submissionLine}

## Files Checked

- Repo root (cwd): ${REPO_ROOT}
- Detected project root: ${PROJECT_ROOT}
- Server: ${existsFile(serverFile) ? `✅ ${serverFile}` : "❌ server.js not found"}

---

## TODO-by-TODO Feedback
`;

for (const r of results) {
  feedback += `
### ${r.name} — **${r.score}/${r.max}**

**Checklist**
${r.checklist.length ? r.checklist.map((x) => `- ${x}`).join("\n") : "- (No checks available)"}

**Deductions / Notes**
${r.deductions.length ? r.deductions.map((d) => `- ❗ ${d}`).join("\n") : "- ✅ No deductions. Good job!"}
`;
}

feedback += `
---

## How marks were deducted (rules)

- JS comments are ignored (so starter TODO comments do NOT count).
- Checks are intentionally lenient and verify top-level implementation only.
- Code can be in ANY order; repeated code is allowed.
- Common equivalents are accepted, and naming is flexible where possible.
- npm install commands and manual testing commands are NOT graded.
- Missing required items reduce marks proportionally within that TODO.
- Port 3000 is intentionally NOT graded.
- Route checks verify top-level logic only, not exact response wording beyond required fields/messages.
`;

/* -----------------------------
   Write outputs
-------------------------------- */
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

const csv = `student,score,max_score
all_students,${totalScore},${TOTAL_MAX}
`;

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
fs.writeFileSync(path.join(ARTIFACTS_DIR, "grade.csv"), csv);
fs.writeFileSync(path.join(FEEDBACK_DIR, "README.md"), feedback);

console.log(
  `✔ Lab graded: ${totalScore}/${TOTAL_MAX} (Submission: ${submissionScore}/${SUBMISSION_MAX}, TODOs: ${stepsScore}/${STEPS_MAX}).`
);