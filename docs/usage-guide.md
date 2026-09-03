# Usage Guide — AI Agent Activity Visualizer

This guide is about **using** the dashboard day to day — not the technical
details behind it.

> There's also a built-in guide inside the dashboard itself — click the
> **Help** button at the right end of the status bar for a quick reference
> in Indonesian or English without leaving the app.

## Who this is for

Anyone using [Claude Code](https://docs.claude.com/en/docs/claude-code) for
day-to-day coding who wants to **see** what the agent is doing live — which
file it's reading, what it's editing, what commands it's running — instead
of reading text scrolling by quickly in a terminal.

## Step 1 — Start the Agent Server & Dashboard

Open two terminal windows in this project's folder.

**Terminal 1:**
```bash
npm install
npm run server
```
Keep this terminal open for as long as you want to use the dashboard — this
is what captures & stores the agent's activity.

**Terminal 2:**
```bash
npm run dashboard
```
Open the address printed in this terminal (usually `http://localhost:5173`)
in your browser.

## Step 2 — Try it first without Claude Code

Before connecting a real Claude Code session, you can try a simulation first
to see what the interface looks like.

**Terminal 3:**
```bash
npm run mock-agent
```

This terminal will print a `session_id`, for example:
```
Mock agent mulai, session_id=mock-session-xxxxxxxx-xxxx-...
```

Copy that `session_id`.

## Step 3 — Enter the session_id into the dashboard

In the dashboard now open in your browser, there's a session input box near
the top. Paste in the `session_id` you just copied, then click **Tonton**
("Watch").

> **Why does it have to be entered manually?** The dashboard deliberately
> **never guesses** which session to display — so if several Claude Code
> sessions happen to be running at once (say you have two projects open at
> the same time), no activity from another session ever leaks into your
> view. You decide which session to watch.

Once you click Watch, the timeline fills in immediately and keeps growing as
the agent (mock or real Claude Code) does things — no refresh needed.

Don't have a `session_id` handy? Two shortcuts, both still an explicit click
(the dashboard never auto-picks a session for you):
- **Tonton sesi terbaru** ("Watch latest session") — jumps straight to
  whichever session most recently sent an event to this Agent Server.
- **Recent Sessions** — while nothing is being watched, the dashboard lists
  every `session_id` this Agent Server currently knows about (with event
  count + last-activity time) — click one instead of copy-pasting an ID.

## Step 4 — Connect a real Claude Code session

Once you've seen how it works via mock-agent, it's time to set it up for a
real Claude Code session. This only needs to be **installed once** — after
that, every Claude Code session on your machine (in any project) is captured
automatically.

1. **Easiest way**: open the dashboard while no session is being watched —
   it shows a status card **"Claude Code hooks: X/Y installed"**. If
   incomplete, click **Install Hooks** and it's done automatically, no
   manual file editing needed. (Manual alternative, for full control: follow
   the steps in [`hooks/README.md`](../hooks/README.md) instead — it's just
   pasting one config block into `~/.claude/settings.json`.)
2. Make sure the Agent Server is still running (`npm run server`).
3. Start or continue a Claude Code session as usual.
4. Find that session's `session_id` — usually visible near the start of the
   transcript/Claude Code's output, or just ask Claude Code directly:
   *"what's this session's session_id?"*
5. Paste that `session_id` into the dashboard, click **Tonton** ("Watch").

If the session had already been running for a while before you installed the
hooks and the dashboard still shows nothing, wait a few more conversation
turns — there's a more detailed note about this in `hooks/README.md`.

## Reading the dashboard

![Dashboard view](screenshots/dashboard-overview.png)

**Top bar** — connection status to the Agent Server, the session currently
being watched, the agent's current status (`thinking` / `completed` / etc.),
the active file, session duration, and how many events have come in.

New here and not sure what a color or icon means? Click **"Keterangan"** in
the bottom-right corner — a small collapsible legend spells out what
yellow/green/red/gray and each icon stand for, without needing anyone to
explain it to you first.

**Agent Overview (left column)** — a summary of the session:
- A **current activity** card — what the agent is doing right this second.
- Stat tiles — number of "thinking" turns, files touched, tool calls, test
  results (if any), tokens, and the model in use.
- **Session Timeline** — a mini chart of the sequence of activity from start
  to now.
- **Changed Files** — every file the agent has touched so far, with a
  `+lines/-lines` total (like `git diff --stat`). Click a file to jump
  straight to its most recent edit in the Activity Flow and Details panel.
- **Token Usage (last 5 hours)** — real numbers from Claude Code's local
  transcript, specific to the session being watched, over the last 5 hours.
  This is a usage figure, **not** a remaining-quota/limit figure (true
  account-wide limit data simply isn't accessible from outside) — treat it
  as an indicator of how active this session has been, not "quota left."

**Activity Flow (middle column)** — a chronological list on the left + a
node graph on the right. Both show the same sequence of activity, just in
different shapes:

![Activity Flow — node graph](screenshots/activity-flow-graph.png)

- Node/border color: **yellow** = in progress, **green** = succeeded,
  **red** = error.
- Click any activity (in the list or in the node graph) to see its details
  in the **Details** panel (right column) — including the diff for lines
  that changed if it's a file-edit action, the output if it's a terminal
  command, and sometimes an **Agent Thoughts** note (Claude's own text right
  before that action, straight from the local transcript — often blank, and
  that's normal, not a bug).
- The Details panel has an **Open in VS Code** button — click it to jump
  straight to the changed line in your editor.

**Bottom section:**
- **Terminal / Log Output** — a short summary by default (tool, file/command,
  status). Flip the **Debug mode** switch in its header on to see the raw
  JSON of the event instead — useful if you (or whoever's helping you) need
  to see exactly what a hook sent, not just the friendly version.
- **Git** — completely separate from Activity Flow; shows the git status of
  whichever project you're currently looking at (based on the active file,
  or the session's folder if no file has been touched yet). Three tabs:
  - **Status** — staged / modified / untracked files.
  - **Diff** — click any file in Status to see its colored diff here
    (green = added, red = removed).
  - **History** — the last ~20 commits (hash, author, message, when).

  This panel only ever *reads* — `git status`, `git diff`, `git log`. It
  never commits, pushes, pulls, checks out, or resets anything, and it
  refreshes itself every ~5 seconds on its own. If the project isn't a git
  repo at all, it just says so — that's normal, not an error.
- **Insights** — four small tabs: **Files** (every file touched this
  session, click to jump to Activity Flow), **Cost** (a dollar estimate from
  token usage, public list pricing — not an actual bill), **Alerts**
  (notification & permission-decision history for this session), **Tests**
  (a PASS/FAIL summary auto-detected from terminal output, if any).

If the Git panel says "bukan bagian dari git repo" or Terminal is empty,
that's expected as long as the agent hasn't touched any files yet in that
session (e.g. a freshly started session), or the project genuinely isn't
under git.

## Approving or denying a tool call from the dashboard

Next to "Berhenti menonton" there's a **Command Approval** mode selector with
three options — **Off / Manual / Auto** — off by default for every session.

- **Off** (default): nothing changes at all — Claude Code behaves exactly
  like it always did, no extra delay, for that session.
- **Manual**: when Claude Code is about to edit a file or run a command
  (Edit/Write/Bash/PowerShell), a red card appears at the top: **"Claude
  Code minta izin: Edit / Bash"**,
  with the file or command it wants to run, a countdown, and two buttons —
  **Tolak** (deny) and **Izinkan** (allow). Clicking either one genuinely
  controls whether Claude Code proceeds — this isn't just a notification. If
  you don't answer within the countdown (20 seconds), it falls back to Claude
  Code's own normal permission prompt in your terminal/VS Code — you can
  still answer there as usual. The dashboard is an optional shortcut, never
  the only way to respond.
- **Auto**: never pauses at all — every edit/command runs immediately with
  no waiting. Each one still shows up in Activity Flow with a small **AUTO**
  tag next to it, so there's still a visible trail even though nothing was
  asked of you. Use this only for a session you fully trust.

Switching the mode only affects the one session you're currently watching,
not every Claude Code session on your machine.

Separately, a **yellow** banner (not red, no buttons) can also appear for
other kinds of notifications from Claude Code (like an idle reminder) — that
one really is read-only, just letting you know something needs your
attention elsewhere.

## Switching sessions or stopping

While watching a session, the top bar shows two buttons:
- **Ganti sesi** ("Switch session") — enter a different `session_id` without
  losing the connection.
- **Berhenti menonton** ("Stop watching") — go back to the empty screen.

The session you're watching is **remembered automatically** — if you refresh
the page or close and reopen the browser, the dashboard picks right back up
watching the same session without needing to type it in again.

## Watching from another device, or a different machine's Agent Server

The dashboard can be opened from other devices on the same local network —
run `npm run dashboard`, then open the **"Network:"** address printed in the
terminal (not "Local:") from that other device (phone, another laptop).

If the Agent Server itself is running on a **different machine** than the
one you're viewing the dashboard from (e.g. watching a session running on
your desktop from your laptop), click the **Server** icon in the status
bar and enter the target host/IP — it checks the address is reachable
before saving, so a typo or wrong port shows a clear error instead of
leaving the dashboard stuck disconnected. The icon shows the current host
right on it, and turns blue whenever you're on a non-default server, so
it's obvious at a glance which server you're pointed at. Most single-machine
setups never need to touch this at all — it's opt-in, only relevant for the
cross-device scenario.

## Starting a chat directly from the dashboard

There's a **Chat** panel on the right side of the dashboard. If nothing is
being watched yet, or the session you're watching has no chat history, you
get a form: **project folder** (full path, e.g. `C:\laragon\www\sirkasir`)
and a **first instruction**. Submit it, and the dashboard starts a real
Claude Code session right there — you'll see your message, then Claude
Code's reply streaming in live, and every other panel (Activity Flow, Token
Usage, …) fills in automatically, exactly like watching any other session.

Once started, keep the conversation going with the input box at the bottom
of the Chat panel — no need to switch to VS Code or a terminal at all.

**Important:** check **"Nyalakan Command Approval untuk sesi ini"** before
starting, if you want Claude Code to be able to edit files or run commands
in this chat (this starts the session in **Manual** mode). Sessions started
this way have no terminal to fall back to — if Command Approval is Off,
every edit/command is automatically refused (Claude Code will tell you so in
the chat). You can also pick Manual or Auto from the Command Approval
selector at the top afterward if you forgot, or switch from Manual to Auto
once you trust the session.

This chat only works for sessions **started from the dashboard itself** — it
can't reach into a session you already have open in VS Code and start
chatting with it (that one's driven by VS Code, not the dashboard). Watching
an existing session stays exactly as described above: read-only, unless you
also turn on Command Approval for it.

## Using it directly from VS Code (optional, no dashboard tab needed)

If you'd rather not keep a separate browser tab open, there's also a
lightweight version as a VS Code extension: a small status bar item + line
highlighting for the file being edited + a log panel in the sidebar.
Installation steps are in
[`vscode-extension/README.md`](../vscode-extension/README.md).

## FAQ

**Does this add to my Claude Code token usage/cost?**
No. The dashboard only reads data that already exists (hook payloads, local
transcripts) — there's no extra LLM call of any kind just to power this
visualization.

**Is the activity history recorded here ever sent back to Claude Code?**
No. This is purely one-way — the dashboard only watches, it never
participates in the conversation or Claude Code's reasoning process.

**If I close the server or restart my computer, is the history lost?**
Yes — the Agent Server keeps history in memory (not in a file), so old
session history is lost once the Agent Server is shut down. This is by
design for day-to-day use (watching an actively running session), not for
long-term archiving.

**Is it safe if several Claude Code sessions run at the same time?**
Yes — since the dashboard only ever displays the session you entered
manually, activity from other sessions can never bleed into your view.
