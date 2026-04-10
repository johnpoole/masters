# Project Instructions

## Build & Run

- No build step — static HTML/JS/CSS site
- Open `index.html` in a browser to run
- No test framework; verification is manual/visual
- `update.bat` — PowerShell script that downloads fresh leaderboard JSON from PGA Tour / Masters.com and commits it

## Architecture

- **Language:** Vanilla JavaScript with D3.js v3 for visualization, Bootstrap 4 for layout
- **Entry point:** `index.html` loads all scripts and renders into SVG container divs
- **Data flow:** CSV/JSON files → `main.js` processPlayers() → buildNodes()/buildLinks() → enrichPicks() calculates earnings → tabulate() renders HTML table
- **Key files:**
  - `main.js` — core data loading, payout calculation, table rendering
  - `force.js` — D3 force-directed graph (partially integrated)
  - `chordBubble.js` — D3 chord/bubble visualization (legacy, adapted from a different project)
  - `purse.csv` — prize money by finishing position (1st–50th)
  - `MastersPool2023.csv` — pool participants and their 8 golfer picks
  - `scores.json` — Masters tournament leaderboard data
- **External CDN dependencies:** D3.js v3, Bootstrap 4, queue.v1.min.js (loaded but unused)

## Coding Conventions

- camelCase for variables and functions
- D3 method chaining for DOM manipulation
- Promise-based async data loading (`Promise.all`)
- No linter or formatter configured
- Sparse comments

## Gotchas

- Player matching is fragile — relies on exact `"first_name last_name"` string equality between CSV picks and JSON leaderboard
- Payout calculation splits prize money evenly among tied players and caps at position 50; positions beyond 50 or "cut" status get $0
- Pool picks are read from CSV columns `pick1` through `pick8` — column names are hardcoded
- `update.bat` still references the 2018 PGA Tour URL by default; the 2024 Masters.com URL is only in a comment
- `force.js` and `chordBubble.js` are not called from `main.js` — they appear partially integrated or unused
- `chordBubble.js` contains vestiges from a political donations project (PAC/candidate/contributor references)
- `scores.json` expects path `scoresData.results.leaderboard` — structure mismatch can silently produce empty results
- Requires internet for CDN-hosted libraries (D3, Bootstrap)

## Advisor Pattern

This project uses the Claude advisor pattern. When building agents or API integrations, pair a Sonnet/Haiku executor with an Opus advisor.

### Tool Definition
```json
{
    "type": "advisor_20260301",
    "name": "advisor",
    "model": "claude-opus-4-6"
}
```

### Executor System Prompt
```
You have access to an `advisor` tool backed by a stronger reviewer model. It takes NO parameters — when you call advisor(), your entire conversation history is automatically forwarded.

Call advisor BEFORE substantive work — before writing, before committing to an interpretation, before building on an assumption. If the task requires orientation first (finding files, fetching a source, seeing what's there), do that, then call advisor.

Also call advisor:
- When you believe the task is complete. BEFORE this call, make your deliverable durable.
- When stuck — errors recurring, approach not converging, results that don't fit.
- When considering a change of approach.
```

### Cost Control
- Use `max_uses` to cap advisor calls per request
- Enable `caching: {"type": "ephemeral", "ttl": "5m"}` for 3+ advisor calls
- Beta header required: `advisor-tool-2026-03-01`
