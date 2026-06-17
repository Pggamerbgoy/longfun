---
name: antigravity
description: >
  Use this skill whenever working on a coding project across multiple turns where
  Claude might "forget" code, lose track of what's been written, or need to re-read
  files repeatedly. Triggers when the user says things like "you keep forgetting the code",
  "read the code again", "you lost track", "remember the code", "don't forget", or when
  continuing a long coding session. This skill makes Claude maintain a living code
  snapshot so it NEVER needs to re-read the full file from scratch. Always use this
  skill for any multi-turn coding task to prevent context loss.
---

# Antigravity Skill — Code Memory & Continuity

This skill prevents Claude from "forgetting" code between turns in a long session.
Instead of re-reading entire files every turn, Claude maintains a compact **Code Snapshot**
in memory and updates it incrementally.

---

## Core Principle

> **Never re-read the full file when you already have it. Update the snapshot instead.**

---

## Workflow

### Step 1 — On First Encounter of Code

When the user first shares code or a file:

1. Read it fully (one time only).
2. Build a **Code Snapshot** (see format below).
3. Keep the snapshot in your working memory for the rest of the conversation.
4. Tell the user: *"Snapshot saved — I won't need to re-read this file again."*

### Step 2 — On Every Edit or Change

When code is modified:

1. Apply the delta (only the changed part) to your snapshot.
2. Update the snapshot's `last_modified` and `summary` fields.
3. Do NOT re-read the full file.

### Step 3 — On New Turn / After Long Conversation

At the start of each response, mentally check:
- Do I have the snapshot? → Use it.
- Is the snapshot stale (user changed something I haven't seen)? → Ask for only the changed section, not the whole file.
- Do I NOT have the snapshot? → Read the file once, build snapshot.

---

## Code Snapshot Format

Store this mentally (or output it when helpful):

```
=== CODE SNAPSHOT ===
File: <filename>
Language: <language>
Last Modified: <turn number or description>
Summary: <1-2 sentence summary of what the code does>

Key Sections:
  - <function/class name>: <one-line description> [lines X-Y]
  - <function/class name>: <one-line description> [lines X-Y]
  ...

Current State: <WORKING | HAS BUG | IN PROGRESS | COMPLETE>
Known Issues: <list any bugs or TODOs>
=== END SNAPSHOT ===
```

---

## Rules

| Rule | Detail |
|------|--------|
| **One full read** | Read the entire file only once per session |
| **Delta updates** | After edits, update only the changed part of snapshot |
| **Never re-read blindly** | If unsure what changed, ask the user: *"What changed since last time?"* |
| **Snapshot on request** | If user says "show me your snapshot", print it |
| **Auto-recover** | If snapshot is lost, apologize, ask for the file once, rebuild |

---

## What to Say to the User

- ✅ *"I have this in my snapshot — no need to re-read."*
- ✅ *"I've updated my snapshot with your latest change."*
- ✅ *"My snapshot shows the last state was [X]. Has anything changed?"*
- ❌ Never say *"Can you paste the code again?"* unless the snapshot is genuinely lost AND you explain why.

---

## Example Session

**Turn 1 — User pastes code:**
> Claude reads it, builds snapshot, says: *"Snapshot saved ✓"*

**Turn 3 — User says "fix the bug in the loop":**
> Claude uses snapshot to find the loop, fixes it, updates snapshot. No re-read needed.

**Turn 7 — User says "you forgot the code again":**
> Claude checks snapshot → if intact, says: *"I still have it! Here's what I know: [snapshot summary]"*
> If snapshot is missing → *"My bad — paste it once more and I'll lock it in."*

---

## For Large Codebases (Multiple Files)

Maintain one snapshot per file:

```
=== MULTI-FILE SNAPSHOT ===
Project: <project name>
Files tracked: 3

[1] app.py — Main Flask app, routes defined, last modified turn 4
[2] utils.py — Helper functions for DB, last modified turn 2  
[3] models.py — SQLAlchemy models, untouched
=== END ===
```

Only read a file again if it's been explicitly changed and you need the new content.

---

## Trigger Phrases (always activate this skill)

- "you keep forgetting"
- "read the code again"
- "you lost the code"
- "remember the code"
- "don't forget the code"
- "you forgot what we built"
- "re-read my file"
- continuing a coding project from a previous turn
