# PR Review Companion

Turn GitHub pull-request review feedback into clean markdown, tame huge "Files changed" lists, and keep working when
GitHub changes its page. A browser extension for Chrome and Firefox (Safari is experimental). Everything runs locally in
your browser: no server, no account, no telemetry, no AI inside.

> Unofficial. Not affiliated with or endorsed by GitHub.

- [What it does](#what-it-does)
- [Install and run](#install-and-run)
- [A 60-second tour](#a-60-second-tour)
- [When GitHub changes its page (selector drift)](#when-github-changes-its-page-selector-drift)
- [Locator reference](#locator-reference)
- [Settings worth knowing](#settings-worth-knowing)
- [Privacy and permissions](#privacy-and-permissions)
- [Troubleshooting](#troubleshooting)
- [Project layout and development](#project-layout-and-development)
- [Limits](#limits)
- [Made with Claude](#made-with-claude)

## What it does

**Capture feedback as markdown.** Reads each review's summary box and every inline thread, one at a time, using GitHub's
own "Copy Markdown" for exact text. Code suggestions are read from the page with their line numbers (GitHub will not copy
them for you). The result lands in an editable text box with Copy, Download and Clear. Each capture is self-checked and
shown with an alert, so a wrong or incomplete capture is obvious.

**See what changed since last time.** Remember a capture and the next one can show only new and edited comments, plus
what was resolved. New and edited threads are outlined right on the GitHub page.

**Know who is reviewing.** Review bots are recognised by author name. Copilot has dedicated handling; CodeRabbit,
Claude, Codex, Gemini and Sourcery are placeholders; you can add your own. Include or leave out each one, and choose
whether its comments are labelled in the output.

**Filter Files changed.** One click hides or isolates tests, snapshots, generated files, images (including SVG), binary
files, and new, deleted, edited or renamed files. The file tree on the left follows along. What counts as a test or a
snapshot comes from pattern lists you can extend per repo and per folder, from ready-made stack packs (iOS, Android,
E2E), and from a repo's Jest config.

**Survive GitHub changes.** Everything the extension looks for on the page is a named, editable *locator*. A built-in
**Doctor** checks them and shows its verdict as a dot and a toolbar badge. A **DevTools sidebar** lets you repair a
locator in a few minutes. See [selector drift](#when-github-changes-its-page-selector-drift).

**Easy to use.** A small tab on the left edge of a PR page opens the tools. Every button, field and menu has a hover hint.

## Install and run

Requirements: Node 20 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev            # opens Chrome with the extension loaded and reloads it as you edit
```

The dev browser keeps its profile in `.dev-profile/`, so your saved selectors and your GitHub login survive restarts.

To install a build in your everyday browser:

```bash
pnpm build          # Chrome: output in dist/chrome-mv3
pnpm build:firefox  # Firefox: output in dist/firefox-mv*
pnpm build:safari   # then convert dist/safari-mv* with Apple's safari-web-extension-converter (macOS + Xcode)
```

- **Chrome:** open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, choose `dist/chrome-mv3`.
- **Firefox:** open `about:debugging`, **This Firefox**, **Load Temporary Add-on**, choose `manifest.json` in the Firefox output folder.
- Builds keep source maps and are not minified, so errors point at real source lines.
- After rebuilding, click the reload icon on the extension and reload the GitHub page. Tabs that were already open keep
  running the old script.

Other commands: `pnpm test` (Vitest), `pnpm compile` (TypeScript) and `pnpm lint` (ESLint; a light ruleset that flags real
mistakes and leaves style alone).

## A 60-second tour

1. Open any pull request. A **PR tools** tab sits on the left edge of the page. Its dot is the Doctor's verdict:
   green = all good, amber = needs attention, red = problems, grey = checking.
2. **Capture feedback**
   1. Optional, for long PRs: **Load all** clicks every "Load more" / "Load diff" button until everything is loaded.
   2. Tick **Include resolved threads** if you want those too (they are collapsed and usually already dealt with).
   3. Click **Capture**. Progress shows as "Capturing 3 of 12: path", and **Stop** keeps what was read so far.
   4. Read the alert above the text box. Green means consistent; amber or red says exactly what is missing.
   5. Edit or select what you need, then **Copy** (floating button on the box, or the one below it) or **Download**.
      Nothing reaches your clipboard until you click.
3. **Filter files** on the Files changed tab with the preset buttons. **Restore all** brings everything back instantly.
4. The **toolbar popup** has four tabs: **Doctor** (health checks and a diagnostics report), **Locators** (export,
   import or clear your saved selectors), **Access** (optional permission to read repo files) and **Reset** (wipe the
   extension's memory, with a yes/no confirmation).

## When GitHub changes its page (selector drift)

GitHub changes its markup every few weeks. When it does, a locator stops finding its element and part of the extension
quietly stops working. This is expected, and it is meant to be fixed by you, in minutes, without touching code.

### How you notice

- The **PR tools** dot or the toolbar badge turns amber or red.
- The popup's **Doctor** tab lists what failed, for example `fail: File path link - no match for "thread.path"`.
- A capture alert says something is missing (for example "no line range found" that does not go away).

The Doctor re-checks up to five times with growing pauses, because GitHub loads parts of a page lazily. A brief amber that
turns green on its own is just a slow page. Red that stays after the retries is real.

### Fix it (about five minutes)

1. **Find the failing locator.** Popup, **Doctor** tab, note the failing line. The key is the name in quotes, such as
   `thread.path`. In the DevTools sidebar the failing keys also appear as a "Needs fixing" row of buttons.
2. **Open DevTools** (`F12`, or `Cmd+Opt+I` on macOS) on the GitHub page and go to the **Elements** panel. In the right-hand
   sidebar open the **PR Companion** tab. If it is not visible, widen the sidebar or look under the `»` overflow arrow.
   Close and reopen DevTools if it never appears after an extension reload.
3. **Choose what you are fixing.** Click the failing key, or pick it from "Fixing this locator". Nothing can be saved
   until a key is chosen. Hover the key for what it finds and what to select; the same text is shown under the dropdown
   and in the [reference table](#locator-reference) below.
4. **Select the right element** in the Elements panel (click it in the tree, or use the element picker and click it on
   the page). Menus close when focus leaves the page. To inspect one, open DevTools' drawer with `Esc`, choose
   **Rendering**, tick **Emulate a focused page**, then open the menu.
5. **Refine the target** if needed with **Parent**, **Child**, **Prev**, **Next** and **Into shadow**. Parent is the element
   containing the current one (it steps out of a shadow root to its host); Prev and Next are siblings on the same level;
   Into shadow goes to the first element inside a shadow root.
6. **Check "This element looks like".** The sidebar lists the built-in locators the selected element already matches. If
   the key you chose disagrees, you get a warning: you probably picked the wrong key or the wrong element.
7. **Pick a selector option.** Options are ranked most durable first. Each shows how many elements it matches on the page;
   the best one matches what you want, and ideally only that. Prefer test ids and stable attributes. Avoid anything with
   a hashed class name (looks like `button__x7Kq2`), because it will break again at the next deploy. If an element's id
   contains a number that changes (`review-12345`), choose the prefix form (`[id^="review-"]`).
8. **Test.** It highlights every element the chosen selector matches on the page. Nothing is saved.
9. **Update CSS & shadow DOM pattern.** This saves it and confirms the browser kept it. The extension compares the Doctor
   before and after: if the save made checks worse you get a red message and an **Undo that change** button.
10. The Doctor re-runs by itself. The dot and badge go green when the locator works again.

Your saved selector is tried first; the built-in one is the fallback only if yours matches nothing. That is why a *wrong*
saved selector can break things that used to work.

### Good to know

- **Shadow DOM.** Elements inside an open shadow root are supported: the sidebar saves the path of host elements to open.
  Closed shadow roots cannot be reached from an extension; select the host element instead.
- **No DevTools (Safari).** Use the panel's **Inspector** section: choose a key, click **Pick element**, click the element
  on the page, choose an option, save. It is a lighter version of the same flow.
- **Undo and cleanup.** The sidebar's "Your saved selectors" list has **Reset** per key and **Reset all**. The popup's
  **Locators** tab has **Clear**. The **Reset** tab wipes everything the extension remembers.
- **Share a fix.** Popup, **Locators**, **Export** gives JSON you can send to a teammate, who pastes it and clicks
  **Import**. Invalid or unknown entries are skipped and reported.
- **A brief mark on the page.** While you select an element, the extension sets a `data-prc-sel` attribute on it for a
  moment so it can find it, then removes it. Nothing else on the page is changed by the inspector.

### If you are stuck

Popup, **Doctor**, **Copy diagnostics**. The report describes the page's *structure* (element names, classes, counts,
masked ids, test ids, the first review thread and review box outline). It contains no comment text, no file contents and no
links, so it is safe to paste into a bug report or to an AI assistant. Look at its `locators` section: every key shows
how many elements it found and whether the result came from a default or from your saved selector (`via override`).

## Locator reference

Every key, what it finds, and what to select in the Elements panel when you repair it.

| Key | What it finds | What to select in Elements |
| --- | --- | --- |
| `thread.all` | Review thread container | The whole review thread box: the custom element that wraps the file path, the code preview and the comments. |
| `thread.path` | File path link inside a thread | The file path link at the top of a review thread. |
| `thread.chevron` | Thread expand/collapse toggle | The small arrow button at the left of a thread header that collapses or expands it. |
| `thread.rangeHeader` | "Comment on lines +a to +b" header | The small label with the line range ("Comment on lines +12 to +14") above a thread's code, or any element or link that holds the range. Copilot threads usually have none; the code preview is used instead. |
| `thread.diffRows` | Diff-context rows (line-number fallback) | One row of the small code preview at the top of a thread (the table with line numbers). |
| `comment.container` | One comment inside a thread (used with closest) | One whole comment inside a thread: header, text and menu. Not the whole thread and not the whole review. |
| `review.item` | Whole review in the timeline: wrapper with the "reviewed 20 hours ago" header (id pullrequestreview-N changes per review) | The whole review in the timeline: the "reviewed N hours ago" line plus the summary box and the thread rows under it. Its id has a number that changes, so use the prefix suggestion. |
| `review.box` | Review summary comment box: header, author, body, menu (the inner element that shares the review id) | The review summary comment box ("Copilot left a comment"): its header, text and menu. It shares the review id with the wrapper; choose the inner box. |
| `review.time` | Review timestamp inside the review wrapper | The date or "N hours ago" element of a review. |
| `comment.menu.react` | Copilot/React comment menu button | The ⋯ button in the header of a Copilot / React-style comment. |
| `comment.menu.details` | Human/legacy comment menu summary | The ⋯ button in the header of a human or review-summary comment (a summary element). |
| `menu.item` | An entry inside an open comment menu (for example Copy Markdown) | An entry inside an open ⋯ menu (for example "Copy Markdown"). Menus only exist while open: keep one open with Rendering > Emulate a focused page. |
| `comment.body` | Rendered comment body (Copilot: span.markdown-body[comment-testid^="Comment message html"]) | The comment text area (the rendered message). |
| `comment.title` | Finding title above an automated (Copilot) comment body | The bold finding title above a Copilot comment's text. |
| `comment.author` | Comment author name | The author's name in the comment header. |
| `comment.textarea` | Hidden edit textarea holding raw markdown | The hidden edit box that holds a comment's raw markdown (only on comments you can edit). |
| `suggestion.block` | Copilot suggestion block | The "Suggested changeset" box of a Copilot comment: file name, code table and buttons. |
| `suggestion.table` | Copilot suggestion diff table | The table of code lines inside the suggestion box. |
| `suggestion.marker` | +/- marker inside a diff line | The + or - sign at the start of a changed code line in the suggestion. |
| `suggestion.codeText` | Code text inside a suggestion diff cell (excludes the +/- marker and line numbers) | The code text of one line in the suggestion table (not the line numbers, not the + or -). |
| `load.more` | "Load more" style buttons | A "Load more" or "Load diff" style button. |
| `files.row` | One file's section on Files changed (older virtualized list: data-path-digest + data-index; newer list: id="diff-<digest>") | One file's whole section on the Files changed tab. |
| `tree.root` | The file tree on the left of Files changed | The whole file tree list: the element with role="tree" and the label "File Tree". |
| `tree.item` | One folder or file entry in the file tree (its id is the path) | One row of the file tree. Files have no expand arrow; folders do. |
| `files.path` | File header path text (screen-reader text carries "old renamed to new") | The file name in a file's header on the Files changed tab. |
| `files.hunk` | Hunk header line ("@@ -a,b +c,d @@") inside a file row | The "@@ -1,5 +1,5 @@" line inside a file's diff. |
| `commits.button` | Commit range picker button on Files changed | The "All commits" button on Files changed that opens the commit picker. |
| `commits.list` | Commit range list inside the picker popover | The list of commits inside the opened commit picker. |
| `commits.item` | One commit option in the picker | One commit entry in the picker. |
| `commits.label` | Commit subject (truncated by GitHub) | The commit message in a picker entry. |
| `commits.description` | Commit author and time | The author and time line in a picker entry. |
| `commits.sha` | Short commit SHA | The short commit id at the right of a picker entry. |
| `pr.headSha` | Element or input exposing the PR head commit SHA | An element or hidden input that holds the PR's newest commit id. |
| `pr.headRef` | PR head branch name label | The head branch name shown near the PR title. |

## Settings worth knowing

- **Remember captures so I can see what changed next time.** On: a capture is compared with the last one you copied or
  downloaded *using the same settings* (resolved threads on or off, review summaries on or off, agents left out), and the
  current one is saved when you copy or download. Off: saved captures are ignored completely and everything is shown.
  If you change a setting after capturing, an amber note says the text is out of date.
- **Clipboard during capture.** By default GitHub's own "Copy Markdown" is intercepted while a capture runs: your clipboard
  is never touched and the browser never asks anything. The checkbox "Let GitHub copy to my clipboard while capturing"
  switches to the normal behaviour after one up-front permission prompt.
- **Agents.** Include or leave out each bot, edit the author names that identify it, add your own, and choose whether its
  comments are labelled (one global default plus a per-agent override).
- **File patterns.** Pick a list (tests, snapshots, generated, docs, images, binary), add globs one per line (`**/*.stories.tsx`,
  `!src/keep.test.ts`; capitals are ignored), and save them temporarily, for the repo, globally, or for one folder
  (useful in monorepos). **Stack packs** add ready-made patterns for iOS, Android and E2E setups.
- **Detect from Jest config.** Reads the config files you list, as text, and never runs them. The first time, allow access
  to that organization in the popup's **Access** tab.
- **Files changed hides, it never reloads.** Only files GitHub has drawn are known to status filters, so on long lists use
  **Load all** and scroll once. Path-based filters (tests, snapshots, images...) judge every file in the tree.

## Privacy and permissions

All data stays in your browser's local extension storage. Nothing is sent to any server, and there is no analytics or
remote code.

| Permission | Why |
| --- | --- |
| Access to `github.com` | Read the page you are viewing and inject the panel. |
| `storage` | Save your settings, saved selectors and remembered captures locally. |
| `clipboardWrite` | Make the **Copy** buttons work. Only used when you click one. |
| `raw.githubusercontent.com/<org>/*` (optional) | Only if you click **Allow** in the popup's Access tab, per organization, revocable there. Used to read files you list (such as Jest configs) with your own GitHub session. |

Production builds also forbid network access from the extension's own pages. Repo config files are read as text and
never executed. The extension never changes GitHub data: it does not post, resolve or edit comments.

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| No **PR tools** tab | The page was open before the extension loaded, or it is not a PR page | Reload the page. If a red "PR tools crashed" box appears, copy its text. |
| Doctor amber or red | Slow page, a wrong saved selector, or real drift | Wait for the re-checks. Then follow [selector drift](#when-github-changes-its-page-selector-drift); if you have saved selectors, try **Reset all** first. |
| Capture returns only review summaries | The threads are resolved | Tick **Include resolved threads**. |
| "No line range found" | The thread's code preview was still loading, or its selector drifted | Capture again; if it stays, repair `thread.rangeHeader`. |
| Comments marked "from rendered HTML" | The comment's menu did not offer Copy Markdown | Fine, but less exact. The alert says what the menu offered. |
| Something exists that the extension says is missing | A wrong saved selector shadows the built-in one | DevTools sidebar, **Reset all**, or popup **Reset** tab. |
| Browser clipboard prompt | The opt-in "Let GitHub copy" mode is on | Untick it, or click Allow once. |
| Filter buttons do nothing | Files not loaded or drawn yet | **Load all**, scroll once, check the Doctor's "Files list rows" and "File tree" lines. |
| Settings vanish in dev | `pnpm dev` started without its kept profile | Keep `.dev-profile/`; use the built extension in your normal browser. |

## Project layout and development

```
src/core/             logic with no UI: capture, locators, filters, doctor, agents, delta, bridge
src/ui/               the in-page panel (React)
src/entrypoints/      content script, popup, background worker, DevTools page and sidebar, clipboard hook
AGENTS-CAPTURE.md     how capture treats each review bot, and how to document the next one
VISION.md             goals and principles
```

Stack: [WXT](https://wxt.dev), React, TypeScript, Tailwind with shadcn-style components, Vitest.

- Locators live in `src/core/locators/defaults.ts`. A test fails if a new key lacks its plain-language description and
  "what to select" text, because those power the inspector tooltips.
- Every control in the interface needs a hover hint; presets and lists have their own hint tests.
- Adding or fixing support for a review bot: follow `AGENTS-CAPTURE.md`.

## Limits

- Selectors are repaired by you, on demand; there is no automatic repair (an optional, bring-your-own AI repair path is
  planned but not built).
- Rich-text export is planned, not built.
- Only the Conversation tab is read for threads; Files changed inline threads use different markup.
- The DevTools sidebar needs Chrome or Firefox. Safari support is experimental.
- GitHub keeps rendering details to itself: some behaviour (for example whether a menu offers Copy Markdown) can only be
  confirmed on a live page, and the Doctor and the capture alert say what they found.

## Made with Claude

```
       ██          ▄▄ ▄▄
  ▄▄▄▄████▄▄▄▄    ███████
▄██▀▀██████▀▀██▄   ▀███▀
███▄▄██████▄▄███     ▀
███▄▀▀▀▀▀▀▀▀▄███
 ▀████████████▀
   ██▄    ▄██
```

Built with [Claude](https://claude.ai), one tiny pixel at a time. Beep boop, with love.
(There is no AI inside the extension. Claude only helped build it.)
