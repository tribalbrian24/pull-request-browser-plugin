import type { LocatorDef } from './types';

export const DEFAULT_LOCATORS = {
  'thread.all': {
    description: 'Review thread container',
    pick: "The whole review thread box: the custom element that wraps the file path, the code preview and the comments.",
    selectors: ['review-thread-collapsible'],
  },
  'thread.path': {
    description: 'File path link inside a thread',
    pick: "The file path link at the top of a review thread.",
    selectors: ['a.text-mono'],
  },
  'thread.chevron': {
    description: 'Thread expand/collapse toggle',
    pick: "The small arrow button at the left of a thread header that collapses or expands it.",
    selectors: ['button.review-thread-chevron', 'button[aria-expanded][data-action*="review-thread-collapsible"]'],
  },
  'thread.rangeHeader': {
    description: '"Comment on lines +a to +b" header',
    pick: "The small label with the line range (\"Comment on lines +12 to +14\") above a thread's code, or any element or link that holds the range. Copilot threads usually have none; the code preview is used instead.",
    selectors: ['div', 'span'],
    text: '^\\s*Comment on lines?\\b',
  },
  'thread.diffRows': {
    description: 'Diff-context rows (line-number fallback)',
    pick: "One row of the small code preview at the top of a thread (the table with line numbers).",
    selectors: ['table.diff-table tbody tr'],
  },
  'comment.container': {
    description: 'One comment inside a thread (used with closest)',
    pick: "One whole comment inside a thread: header, text and menu. Not the whole thread and not the whole review.",
    selectors: ['.js-comment, .review-comment, .timeline-comment, [id^="discussion_r"]'],
  },
  'review.item': {
    description: 'Whole review in the timeline: wrapper with the "reviewed 20 hours ago" header (id pullrequestreview-N changes per review)',
    pick: "The whole review in the timeline: the \"reviewed N hours ago\" line plus the summary box and the thread rows under it. Its id has a number that changes, so use the prefix suggestion.",
    selectors: ['[id^="pullrequestreview-"].js-updatable-content', '[id^="pullrequestreview-"].js-socket-channel'],
  },
  'review.box': {
    description: 'Review summary comment box: header, author, body, menu (the inner element that shares the review id)',
    pick: "The review summary comment box (\"Copilot left a comment\"): its header, text and menu. It shares the review id with the wrapper; choose the inner box.",
    selectors: ['[id^="pullrequestreview-"].timeline-comment-group', '[id^="pullrequestreview-"].timeline-comment'],
  },
  'review.time': {
    description: 'Review timestamp inside the review wrapper',
    pick: "The date or \"N hours ago\" element of a review.",
    selectors: ['relative-time', 'time-ago', 'time[datetime]'],
  },
  'comment.menu.react': {
    description: 'Copilot/React comment menu button',
    pick: "The ⋯ button in the header of a Copilot / React-style comment.",
    selectors: ['button[data-testid="comment-header-hamburger"]'],
  },
  'comment.menu.details': {
    description: 'Human/legacy comment menu summary',
    pick: "The ⋯ button in the header of a human or review-summary comment (a summary element).",
    selectors: ['summary[data-dd-action-name="comment.open_menu"]', '.timeline-comment-actions summary[aria-haspopup="menu"]'],
  },
  'menu.item': {
    description: 'An entry inside an open comment menu (for example Copy Markdown)',
    pick: "An entry inside an open ⋯ menu (for example \"Copy Markdown\"). Menus only exist while open: keep one open with Rendering > Emulate a focused page.",
    selectors: ['[role="menuitem"]'],
  },
  'comment.body': {
    description: 'Rendered comment body (Copilot: span.markdown-body[comment-testid^="Comment message html"])',
    pick: "The comment text area (the rendered message).",
    selectors: ['[comment-testid^="Comment message html"], .comment-body, .js-comment-body, [data-testid="markdown-body"]'],
  },
  'comment.title': {
    description: 'Finding title above an automated (Copilot) comment body',
    pick: "The bold finding title above a Copilot comment's text.",
    selectors: ['h3[class*="automatedComment__title"]', '[data-testid="automated-review-comment"] h3:not(.sr-only)'],
  },
  'comment.author': {
    description: 'Comment author name',
    pick: "The author's name in the comment header.",
    selectors: ['[data-testid="avatar-name"], a.author, .author, [data-testid="avatar-link"]'],
  },
  'comment.textarea': {
    description: 'Hidden edit textarea holding raw markdown',
    pick: "The hidden edit box that holds a comment's raw markdown (only on comments you can edit).",
    selectors: ['textarea[name$="[body]"], textarea.js-comment-field'],
  },
  'suggestion.block': {
    description: 'Copilot suggestion block',
    pick: "The \"Suggested changeset\" box of a Copilot comment: file name, code table and buttons.",
    selectors: ['[data-testid="automated-review-suggestion"]'],
  },
  'suggestion.table': {
    description: 'Copilot suggestion diff table',
    pick: "The table of code lines inside the suggestion box.",
    selectors: [
      'table.unifiedDiffLines__k0eV89, table.UnifiedDiffLines-module__unifiedDiffLines__U966b',
      'table[class*="nifiedDiffLines"]',
    ],
  },
  'suggestion.marker': {
    description: '+/- marker inside a diff line',
    pick: "The + or - sign at the start of a changed code line in the suggestion.",
    selectors: [
      '[data-diff-text-marker]',
      '.diffTextMarker__0JPPZw, .UnifiedDiffLines-module__diffTextMarker__qbJh2',
      '[class*="iffTextMarker"]',
    ],
  },
  'suggestion.codeText': {
    description: 'Code text inside a suggestion diff cell (excludes the +/- marker and line numbers)',
    pick: "The code text of one line in the suggestion table (not the line numbers, not the + or -).",
    selectors: ['[data-diff-text-inner]', '[class*="diffTextInner"]'],
  },
  'load.more': {
    description: '"Load more" style buttons',
    pick: "A \"Load more\" or \"Load diff\" style button.",
    selectors: ['button, [role="button"]'],
    text: '^\\s*(load more|load diff|load \\d+ more|show hidden|show \\d+ hidden|show more)\\b',
  },
  'files.row': {
    description: 'One file\'s section on Files changed (older virtualized list: data-path-digest + data-index; newer list: id="diff-<digest>")',
    pick: "One file's whole section on the Files changed tab.",
    selectors: ['[data-path-digest][data-index]', '[id^="diff-"]'],
  },
  'tree.root': {
    description: 'The file tree on the left of Files changed',
    pick: 'The whole file tree list: the element with role="tree" and the label "File Tree".',
    selectors: ['ul[role="tree"][aria-label="File Tree"]', 'ul[role="tree"]'],
  },
  'tree.item': {
    description: 'One folder or file entry in the file tree (its id is the path)',
    pick: 'One row of the file tree. Files have no expand arrow; folders do.',
    selectors: ['li[role="treeitem"]'],
  },
  'files.path': {
    description: 'File header path text (screen-reader text carries "old renamed to new")',
    pick: "The file name in a file's header on the Files changed tab.",
    selectors: ['h3 a code .sr-only', 'h3 a code'],
  },
  'files.hunk': {
    description: 'Hunk header line ("@@ -a,b +c,d @@") inside a file row',
    pick: "The \"@@ -1,5 +1,5 @@\" line inside a file's diff.",
    selectors: ['[data-diff-cell="hunk"] [data-diff-text-inner]'],
    text: '^\\s*@@',
  },
  'commits.button': {
    description: 'Commit range picker button on Files changed',
    pick: "The \"All commits\" button on Files changed that opens the commit picker.",
    selectors: ['#changes-selector-button'],
  },
  'commits.list': {
    description: 'Commit range list inside the picker popover',
    pick: "The list of commits inside the opened commit picker.",
    selectors: ['ul[aria-label="Select a range of commits"]', 'ul[role="group"][aria-label*="commits" i]'],
  },
  'commits.item': {
    description: 'One commit option in the picker',
    pick: "One commit entry in the picker.",
    selectors: ['li[role="option"]'],
  },
  'commits.label': {
    description: 'Commit subject (truncated by GitHub)',
    pick: "The commit message in a picker entry.",
    selectors: ['[data-component="ActionList.Item.Label"]'],
  },
  'commits.description': {
    description: 'Commit author and time',
    pick: "The author and time line in a picker entry.",
    selectors: ['[data-component="ActionList.Description"]'],
  },
  'commits.sha': {
    description: 'Short commit SHA',
    pick: "The short commit id at the right of a picker entry.",
    selectors: ['[data-component="ActionList.TrailingVisual"]'],
  },
  'pr.headSha': {
    description: 'Element or input exposing the PR head commit SHA',
    pick: "An element or hidden input that holds the PR's newest commit id.",
    selectors: ['input[name="expected_head_oid"]', 'input[name="head_sha"]', '[data-head-sha]'],
  },
  'pr.headRef': {
    description: 'PR head branch name label',
    pick: "The head branch name shown near the PR title.",
    selectors: ['.head-ref', '[data-testid="head-ref"]'],
  },
} satisfies Record<string, LocatorDef>;

export type LocatorKey = keyof typeof DEFAULT_LOCATORS;

export const isLocatorKey = (k: string): k is LocatorKey => Object.prototype.hasOwnProperty.call(DEFAULT_LOCATORS, k);
