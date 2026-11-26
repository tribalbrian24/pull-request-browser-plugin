# AGENTS-CAPTURE

How the PR Review Companion captures comments written by review agents (Copilot and friends), what is known per agent, and how to add the next one.

## How to use this document

- **Adding or fixing an agent:** follow "How to write the next agent section", fill the template, then upload this file plus your redacted samples with the prompt at the end.
- **You only have notes:** upload this file and say: "Add my notes to the `<Agent>` section using the template. Keep anything I did not state as `unknown`."
- Keep this file in the repo and update it whenever an agent's status changes.

## The contract: what capture needs per agent

Capture reads items one at a time (review summaries first, then inline threads; there is one shared menu and one clipboard listener, so they cannot overlap), shows progress, and can be stopped. For each comment:

1. Finds the comment container and its author name (locators `comment.container`, `comment.author`).
2. Matches the author to an agent by whole-token, case-insensitive patterns (`claude` matches `claude[bot]` but not `claudette`). Defined in `src/core/agents/agents.ts`; users can also edit patterns or add agents in the panel.
3. Gets the comment as markdown, in this order:
   1. **Exact (first class):** click the comment's own menu, choose "Copy Markdown", and read what GitHub tries to copy. A small page-side hook sees that copy only while a capture runs and, by default, swallows it so your clipboard is never touched (an opt-in checkbox lets GitHub copy normally after asking the browser for permission once, up front).
   2. The hidden edit textarea (raw markdown), if the page has one.
   3. The rendered comment body converted to markdown. This is lossy and is flagged as such in the validation alert.
4. **Review summaries:** before threads, capture reads each review's summary comment box (for example Copilot's "left a comment": verdict, open issues, resolved items). For newer agent reviews this box is where most of the feedback lives. It uses the box's own menu if it offers "Copy Markdown"; otherwise it converts the rendered body to markdown (flagged as lower fidelity) and stops trying the menu for the remaining reviews.
5. Reads suggestion diffs, if the agent posts them: rows of old line number, new line number and code, emitted as `<line> <+|-| ><code>`. The menu's Copy Markdown does not include these diffs for Copilot, so they are scraped.
6. Applies the agent label (`**Copilot:**`) according to the global default and the per-agent setting, then validates the result and shows an alert in the panel.

An agent needs: author patterns, a comment container and menu the locators can find, and (if it posts suggestions) a suggestion block the locators can parse.

## Where things live

| Concern | File |
|---|---|
| Agent list, patterns, label preference | `src/core/agents/agents.ts` |
| Selectors (named locator keys) | `src/core/locators/defaults.ts` |
| Comment menu and Copy Markdown | `src/core/capture/menu.ts` |
| Capture orchestration, agent filtering | `src/core/capture/capture.ts` |
| Line range and suggestion rows | `src/core/capture/thread.ts` |
| Markdown output and labels | `src/core/capture/markdown.ts` |
| Validation alert | `src/core/capture/validate.ts` |
| Doctor checks | `src/core/doctor/checks.ts` |
| Tests | next to each file, `*.test.ts`, run with `pnpm test` |

Selectors are data. When GitHub changes its markup, fix them from the DevTools "PR Companion" sidebar (select the right element, Update) or paste a selector pack in the popup's Locators tab, before touching code.

## When is an agent "wired"?

All of these are true:

- Author patterns match real login names seen on real PRs.
- The Doctor shows no fail or warn for that agent's comments on both the Conversation and Files changed tabs.
- A capture of real threads gives correct markdown and, if applicable, suggestion lines with line numbers.
- At least one unit test uses a trimmed, redacted sample of that agent's markup.
- Its section below says `wired` with a date.

Only Copilot is wired today. The others are placeholders: they are matched by name and captured with the generic path.

## Agent notes

### Copilot
- Status: wired (verify again after GitHub UI changes).
- Author names seen: `Copilot`. Pattern: `copilot` (token match). The bot's hovercard URL names `copilot-pull-request-reviewer`; confirm the exact login on a live PR.
- Where it comments: inline review threads.
- Comment UI: React. Menu button `button[data-testid="comment-header-hamburger"]`; menu items render in a portal (`#__primerPortalRoot__`) as `[role="menuitem"]`, including "Copy Markdown".
- Thread: custom element `review-thread-collapsible`; resolved threads carry `data-resolved="true"`. The chevron `button.review-thread-chevron` is a toggle (collapse and expand), not an expand button.
- Sample: `src/core/capture/fixtures.ts` (`copilotThread()`), used by `src/core/capture/copilot.test.ts`. It is synthetic: structure and attributes follow the page GitHub renders for an automated review thread on the Conversation tab; all text and ids are invented.
- Thread layout: `review-thread-collapsible[data-resolved]` > header (chevron, file path link `a.text-mono`) > the diff context table (`table.diff-table`, rows with `td[data-line-number]`, used for the line range) > `div#discussion_r<comment id>` > `react-partial[partial-name="automated-review-comment"]` > `div[data-testid="automated-review-comment"]`.
- Comment header: author `span[data-testid="avatar-name"]` ("Copilot"), severity label (for example "High"), menu button `button[data-testid="comment-header-hamburger"]` (menu items: Copy link, Copy Markdown).
- Comment body: finding title `h3.automatedComment__title` (hashed class), text `span.markdown-body[comment-testid^="Comment message html"]`. If Copy Markdown cannot be read, capture falls back to `**title**` plus the converted body.
- Suggestion: `[data-testid="automated-review-suggestion"]` holds a "Suggested changeset" header, the file name, a table (`unifiedDiffLines__k0eV89`) and action buttons (Ask, Commit suggestion, Add suggestion to batch). Table rows: one hunk row with a single cell (`@@ -38,6 +38,7 @@`, skipped), then rows of three cells: old line number, new line number, code. The code is in `div.diffTextInner`; added lines have a `span.diffTextMarker__...` holding `+` (no data attribute). Context rows have no marker and are written with a space in that column. The menu's Copy Markdown does not include this diff, which is why it is scraped.
- Suggestions: `[data-testid="automated-review-suggestion"]` contains a table whose class includes `unifiedDiffLines` (hashed, for example `unifiedDiffLines__k0eV89`). Each row has three cells (old line, new line, code). The +/- marker is `[data-diff-text-marker]` (the hashed class `diffTextMarker__0JPPZw` is a fallback). The menu's Copy Markdown does not include these diffs.
- Review summaries: each review is two nested elements sharing the same id `pullrequestreview-<number>` (the number is different for every review, so selectors match the prefix `[id^="pullrequestreview-"]`). The outer one (`js-comment js-updatable-content js-socket-channel js-minimize-container`, key `review.item`) holds the "Copilot reviewed 20 hours ago" header, the summary box and the thread rows below it. The inner one (`timeline-comment-group ... timeline-comment`, key `review.box`) is the summary comment: header "Copilot AI left a comment", then the body (a verdict line, a collapsible section of open issues, a collapsible section of items resolved since the last review, a review-effort note, an action button, reactions). Its menu loads from a `review_comment/PRR_.../actions` URL when opened. Whether that menu offers "Copy Markdown": unknown, check.
- Locator keys involved: `review.item`, `review.box`, `review.time`, `thread.all`, `thread.path`, `thread.chevron`, `comment.menu.react`, `menu.item`, `comment.container`, `comment.author`, `suggestion.block`, `suggestion.table`, `suggestion.marker`.
- Quirks: the same copy may go through `navigator.clipboard.writeText`, `clipboard.write`, `DataTransfer.setData` or `execCommand('copy')`; the page-side hook listens to all four. Hashed class names change between GitHub deploys; collapsed threads may not render the menu button until expanded.
- Samples: none stored yet. Suggested location `samples/copilot/` (redacted).

### CodeRabbit
- Status: placeholder. Pattern: `coderabbit`. Everything else: unknown.

### Claude
- Status: placeholder. Pattern: `claude`. Everything else: unknown.

### Codex
- Status: placeholder. Pattern: `codex`. Everything else: unknown.

### Gemini
- Status: placeholder. Pattern: `gemini`. Everything else: unknown.

### Sourcery
- Status: placeholder. Pattern: `sourcery`. Everything else: unknown.

## How to write the next agent section

### Step 0: use safe material
GitHub pages can contain private code and names. Use a throwaway PR in a scratch repo if you can. Otherwise redact before sharing anything outside your company (Step 2 says how). Never upload secrets, tokens or customer data.

### Step 1: identify the author
On a real comment by the agent, note exactly what the page shows as the author and, by hovering or opening its profile link, its login (for example `something[bot]`). Write both down.

### Step 2: collect redacted HTML samples
In Chrome DevTools, Elements panel: select the node, right-click, Copy, Copy outerHTML. Then redact: replace code, comment prose, file names and user names with placeholders such as `REDACTED`, but keep every tag, class, `id`, `data-*`, `aria-*` and `role` attribute exactly as it is, because those are what the selectors use.

Collect:
1. **One review thread** that has one comment from this agent (the `review-thread-collapsible` element or whatever wraps the thread).
2. **The comment's menu, open.** Menus close when focus leaves the page. In DevTools press Escape to open the drawer, choose Rendering, and tick "Emulate a focused page", then open the menu, select it in Elements and copy. The menu usually lives in `#__primerPortalRoot__`.
3. **A suggestion block**, if the agent posts suggestions: the element that contains the diff rows.
4. **What "Copy Markdown" copies** for that comment (paste it into a file, redacted), if the menu has that item.
5. Optional: the agent's summary or non-inline comment, if it posts one.

### Step 3: run the Doctor
Open the extension popup on that PR's Conversation tab, then on the Files changed tab. Copy every warn or fail line.

### Step 4: run a capture
Click Capture in the panel. Copy the validation alert text and the redacted output for that agent's thread. Note what is wrong or missing.

### Step 5: fill the template

```
### <Agent name>
- Status: placeholder | in progress | wired (YYYY-MM-DD)
- Author names seen (text on the page and login):
- Pattern(s) to match (whole token, case-insensitive):
- Where it comments: inline review threads | PR conversation | review summary | several
- Comment UI: React (data-testid hamburger) | legacy details/summary | other:
- Copy Markdown in the menu: yes | no (list the menu item labels you saw):
- Suggestions: none | ```suggestion blocks | custom diff block (selector or sample):
- Locator keys that need an agent-specific selector (key -> selector):
- Samples (paths, redacted):
- Doctor result (paste warn/fail lines):
- Capture result and validation alert (paste):
- Quirks:
- Last verified (date, which kind of PR):
```

### Step 6: ask Claude
Upload this file and your samples to Claude and paste the prompt below with the agent name filled in.

### Step 7: verify the change
`pnpm test`, `pnpm compile`, reload the extension, check the Doctor is clean on a PR containing that agent's comments, capture real threads, and compare with what the page shows.

### Step 8: update this file
Set the status and date, add sample paths and any quirks. If you only fixed a selector, record the new selector and the date.

## Prompt to give Claude

```
I'm extending the PR Review Companion browser extension (WXT, React, TypeScript, Vitest).
I've attached AGENTS-CAPTURE.md and redacted HTML samples for the agent: <AGENT NAME>.

1. Read AGENTS-CAPTURE.md first (the contract, the file map, and the definition of "wired").
2. Using my filled-in section and the samples, propose: author patterns; any new or changed
   locator keys (prefer data-testid, data-*, aria-*, role and custom element names; avoid hashed
   class names); and any code changes needed for the menu, copy, or suggestion parsing.
3. Write Vitest tests that use the trimmed samples as fixtures.
4. List what you could not determine and what I should check in DevTools.
5. Give me the updated section for AGENTS-CAPTURE.md. Do not invent facts; write "unknown".

Rules: add no network calls, never execute page code, keep selectors in the locator registry,
keep code comments minimal, and do not commit or push (give me the commands instead).
```

## Known GitHub quirks that affect every agent

- Class names with hashes (for example `diffLineRow__K43czL`) change on deploys. Prefer stable attributes. The Doctor and the DevTools sidebar exist to make this a five-minute fix.
- GitHub has two comment UIs: the React one (hamburger button, menu in a portal) and the legacy one (`details`/`summary`). Both are handled; an agent may use either.
- Files changed is virtualized: only rendered files are in the DOM. Use "Load all" and scroll before capturing.
- Menus render in a portal outside the thread, so they cannot be found by searching inside the thread.
- Collapsed threads can hide their controls; the thread chevron is a toggle.
