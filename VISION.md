# VISION: PR Review Companion

A browser extension (Chrome and Firefox; Safari through Apple's converter) that makes reviewing GitHub pull requests
faster, local and repeatable. It turns review feedback into clean markdown you can hand to Claude, tames long Files
changed lists, and keeps working when GitHub changes its page.

## The problem

- Review feedback comes from people and from review agents (Copilot first). It is scattered across summary boxes,
  inline threads, collapsed and resolved threads, and code-suggestion diffs that GitHub will not let you copy.
- Files changed is long and noisy: tests, snapshots, images, lockfiles.
- GitHub's markup changes every week or month, so anything built on it breaks quietly.

## What it does

**1. Capture feedback as markdown.** Reads review summaries and inline threads, one at a time, using GitHub's own
"Copy Markdown" for exact text. Code suggestions are read from the page with their line numbers, since the menu does not
copy them. Output goes into an editable text box with Copy, Download and Clear; nothing reaches the clipboard until you
click. Each capture is checked and shown with an alert (red, amber, blue or green) so a wrong or incomplete capture is
obvious. Long captures show progress and can be stopped.

**2. See what changed since last time.** Captures can be remembered per PR (and per capture settings) so the next one can
show only new and edited comments, plus what was resolved. New and edited threads are outlined right on GitHub's page.

**3. Know who is reviewing.** Agents are recognised by author name. Copilot has dedicated handling; CodeRabbit, Claude,
Codex, Gemini and Sourcery are placeholders; you can add your own. Each agent can be included or left out, and labelled in
the output (one global setting, overridable per agent).

**4. Filter Files changed.** One-click presets hide or isolate tests, snapshots, generated files, images (including
SVG), binary files, and new, deleted, edited or renamed files. What counts as a test or snapshot comes from layered
pattern lists: built-ins, stack packs (iOS, Android, E2E), a repo's Jest config, and your own global, per-repo,
per-folder and temporary patterns. Hiding never reloads anything and restores instantly, and the file tree on the left follows along (folders that
become empty disappear too).

**5. Stay working when GitHub changes.** Everything the extension looks for on the page is a named, editable locator.
A **Doctor** checks them (retrying while the page loads, red only if they really fail) and shows its verdict as a dot and
a toolbar badge. A **DevTools sidebar** in the Elements panel is the weekly repair loop: select the right element,
refine it (shadow DOM included), test, save. Saves are compared against the Doctor before and after, with Undo. A
**diagnostics report** describes the page's structure without any comment text, safe to paste to Claude.

**6. Easy to use.** A small tab on the left edge of a PR page opens the panel. The toolbar popup holds Doctor, Locators,
Access and Reset. Every control has a plain-language hover hint.

## Principles

1. **Local only. No AI by default.** Everything works without any model. AI, if added, is a separate opt-in path.
2. **Minimal network.** GitHub pages can show sensitive code. Page data never leaves the browser.
3. **GitHub is the source of truth.** Local storage holds only your settings, saved selectors and remembered captures.
4. **Nothing sneaky or forced.** No telemetry, no remote code, no permissions at install. Capture does not touch your
   clipboard (an opt-in mode lets GitHub copy after one up-front browser prompt).
5. **Assume the page will change.** Selectors are data, not code, and are repairable in place.
6. **Markdown is first class.** Exact text from GitHub's own copy is preferred; page text is a labelled fallback.
7. **Low visual impact.** Tools sit at the edge; page changes are limited to hiding files and outlining threads.

## How it works

- **Where it runs:** a content script injects the panel into PR pages (in a shadow root, so styles never leak); a popup,
  a background worker and a DevTools sidebar complete the set.
- **Capture:** a small page-side hook sees what GitHub's Copy Markdown tries to copy while a capture runs and, by
  default, swallows that write. Items are read strictly one at a time, because there is one shared menu and one clipboard
  listener. Collapsed threads are opened first and closed again.
- **Locators:** a registry of named selectors with built-in defaults and your overrides tried first. Stable attributes are
  preferred over GitHub's hashed class names.
- **Storage:** the browser's local extension storage only. Reset Extension Memory wipes it.
- **Stack:** WXT, React, TypeScript, Tailwind with shadcn-style components, Vitest.

## Privacy and network

- Host permission is `github.com` only. Reading repo files (for example Jest configs) is optional: a per-organization
  permission you grant by clicking Allow in the popup, revocable there, used only when you ask.
- Production builds forbid network access from the extension's own pages. Repo configs are read as text and never
  executed. No analytics, no remote code, no sniffing of GitHub's network traffic or private endpoints.
- The diagnostics report and the DevTools tools never include comment text.

## Not goals

- Calling AI services by default, or any server, account, sync or telemetry.
- Changing GitHub data: posting, resolving or editing comments.
- Running repository code.

## Status and known limits

Built and unit-tested offline. Not yet verified in a real extension build on live pages: the DevTools sidebar APIs, the
toolbar badge, the permission prompt, Safari packaging, whether hiding rows leaves gaps in GitHub's virtualized file list,
and whether the review summary box's menu offers Copy Markdown. Only files GitHub has drawn can be filtered, so long
lists need **Load all** first. Open choices and defaults are tracked outside this repository.

## Roadmap (not built)

- Rich-text export.
- Optional, bring-your-own AI locator repair (off by default, with a payload preview).
- Capture rules for the other review agents, from real samples (see AGENTS-CAPTURE.md).
- Automatic stack-pack suggestions and a full commit list from the Commits tab.

## Running it

- `pnpm install`, then `pnpm dev` (opens Chrome with the extension loaded; a kept profile preserves your saved selectors
  and GitHub login), or `pnpm build` and Load unpacked from `dist/chrome-mv3`. Firefox: `pnpm build:firefox`.
- `pnpm test` runs the tests; `pnpm compile` type-checks. Builds keep source maps and are not minified.
- If something breaks after a GitHub change: popup, Doctor, **Copy diagnostics**, paste it to Claude, or follow "Needs
  fixing" in the DevTools sidebar.

## Related documents

- `AGENTS-CAPTURE.md`: how capture treats each review agent, what is known per agent, and how to write the next one.
