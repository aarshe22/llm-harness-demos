# AGENT.md — demo metadata (demo.json)

This repo is a **demo gallery**. Each top-level subfolder is one self-contained
web demo (its entry is `index.html` or the first `*.html`). The gallery
(`index.html` + `server.js`) auto-scans these subfolders on page load and shows
a metadata strip under each thumbnail.

Every demo subfolder SHOULD carry a small metadata file named **`demo.json`**.

## Purpose

`demo.json` records how a demo was produced, so a viewer can see at a glance
which model / harness built it and how big the run was.

## Format

One JSON object per demo subfolder, placed at `<subfolder>/demo.json`.
Human-editable and agent-editable. Recognised fields (all optional except a
sensible minimum):

```json
{
  "schema": 1,
  "modelName": "claude-sonnet-4-5",
  "harness": "opencode",
  "maxContextWindow": 200000,
  "totalTokens": 128400,
  "updated": "2026-09-14"
}
```

| Field               | Type            | Meaning                                             |
| ------------------- | --------------- | --------------------------------------------------- |
| `modelName`         | string          | Model that generated the demo                       |
| `harness`           | string          | Harness / agent tool used to run the model          |
| `maxContextWindow`  | number (tokens) | Max context window of that model (e.g. 200000)      |
| `totalTokens`       | number (tokens) | Total tokens consumed to build this demo            |
| `updated`           | string (ISO)    | Date the demo / metadata last changed               |
| `notes`             | string          | Optional one-line remark                            |

- Numbers may be plain integers or numeric strings; both are accepted.
- Aliases are tolerated (`model`→`modelName`, `tokens`→`totalTokens`,
  `max_context_window`/`maxCtx`→`maxContextWindow`, etc.), but **write the
  canonical snake-free camelCase keys shown above** so files stay uniform.
- Invalid JSON is surfaced as a badge rather than crashing the scan.

## What an agent MUST do

When you **add a new demo subfolder** or **change an existing one**, create or
update that folder's `demo.json` in the same change:

1. Create/refresh `<subfolder>/demo.json`.
2. Fill `modelName` and `harness` from the run that produced the change.
3. Record `maxContextWindow` for the model used.
4. Record `totalTokens` — sum input + output tokens for the run, rounded
   sensibly. Omit it if genuinely unknown rather than guessing.
5. Set `updated` to today's date (ISO `YYYY-MM-DD`).

Do not store secrets, file paths, or large blobs here. Keep it to the fields
above; put prose in the folder's `README.md`.

## How it is consumed (do not break this)

- `server.js` scans subfolders on each `/api/demos` request, reads the first
  found of `demo.json` / `DEMO.json` / `demo.meta.json`, hashes its bytes as
  `metaHash`, and returns normalized `meta` per demo.
- The gallery caches rendered cards and only rewrites a metadata strip when
  that `metaHash` changes, and drops cards when a subfolder's demo disappears.
- So keep filenames exactly `demo.json` (first, and preferred) for predictable
  caching.
