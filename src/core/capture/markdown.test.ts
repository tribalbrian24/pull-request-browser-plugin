import { describe, expect, it } from 'vitest';
import { FENCE, htmlToMarkdown, renderThread, stripOriginallyPosted } from './markdown';

describe('stripOriginallyPosted', () => {
  it('removes italic boilerplate line', () => {
    expect(stripOriginallyPosted('Rename this.\n\n_Originally posted by @a in https://x/pull/1#r1_')).toBe('Rename this.');
  });
  it('removes it inside a blockquote and keeps the rest', () => {
    expect(stripOriginallyPosted('> quoted\n\n> _Originally posted by @b in #12_\n\nMy reply')).toBe('> quoted\n\nMy reply');
  });
  it('removes bold variant', () => {
    expect(stripOriginallyPosted('**Originally posted by @c**\nText')).toBe('Text');
  });
  it('leaves prose that merely mentions it', () => {
    const s = 'This was originally posted elsewhere.';
    expect(stripOriginallyPosted(s)).toBe(s);
  });
});

describe('htmlToMarkdown', () => {
  it('converts common elements', () => {
    const div = document.createElement('div');
    div.innerHTML =
      '<p>Use <code>foo</code> and <a href="https://x">link</a></p><pre><code>a\nb</code></pre><ul><li>one</li><li>two</li></ul>';
    expect(htmlToMarkdown(div)).toBe(`Use \`foo\` and [link](https://x)\n\n${FENCE}\na\nb\n${FENCE}\n\n- one\n- two`);
  });
});

describe('renderThread', () => {
  it('renders heading, body and suggestion lines', () => {
    const out = renderThread({
      path: 'src/a.ts',
      range: '10-12',
      comments: [{ id: null, author: 'bot', text: 'Fix it', reason: '', via: 'menu' }],
      suggestionLines: ['10 -old', '10 +new'],
      suggestionBlocks: 1,
    });
    expect(out).toBe(`# \`src/a.ts:10-12\`\n\nFix it\n\n${FENCE}\n10 -old\n10 +new\n${FENCE}`);
  });
  it('prefixes authors only for multi-comment threads and reports failures', () => {
    const out = renderThread({
      path: 'p.ts',
      range: '',
      comments: [
        { id: null, author: 'a', text: 'one', reason: '', via: 'menu' },
        { id: null, author: 'b', text: null, reason: 'menu never opened', via: 'none' },
      ],
      suggestionLines: [],
      suggestionBlocks: 0,
    });
    expect(out).toBe('# `p.ts`\n\n**a:**\n\none\n\n---\n\n**b:**\n\n(failed to copy comment: menu never opened)');
  });

  it('labels agent comments and delta status', () => {
    const t = {
      path: 'p.ts',
      range: '1',
      comments: [{ id: null, author: 'copilot-pull-request-reviewer[bot]', agent: 'Copilot', text: 'x', reason: '', via: 'menu', status: 'edited' as const }],
      suggestionLines: [],
      suggestionBlocks: 0,
    };
    expect(renderThread(t)).toBe('# `p.ts:1`\n\n**Copilot (edited):**\n\nx');
    const plain = { ...t, comments: [{ ...t.comments[0], status: undefined }] };
    expect(renderThread(plain)).toBe('# `p.ts:1`\n\n**Copilot:**\n\nx');
    expect(renderThread(plain, { labelFor: () => false })).toBe('# `p.ts:1`\n\nx');
    const two = { ...plain, comments: [plain.comments[0], { ...plain.comments[0], agent: undefined, author: 'sam' }] };
    expect(renderThread(two, { labelFor: () => false })).toContain('**copilot-pull-request-reviewer[bot]:**');
    expect(renderThread(two)).toContain('**Copilot:**');
    const unchanged = { ...t, comments: [{ ...t.comments[0], agent: undefined, author: 'sam', status: 'unchanged' as const }] };
    expect(renderThread(unchanged)).toBe('# `p.ts:1`\n\nx');
  });

  it('renders a review summary with a heading instead of a file path', () => {
    const t = {
      kind: 'review' as const,
      when: '2025-01-15 12:00',
      path: 'Review summary',
      range: '',
      comments: [{ id: 'review-1', author: 'copilot-pull-request-reviewer[bot]', agent: 'Copilot', text: 'Looks good overall, two suggestions', reason: '', via: 'menu' }],
      suggestionLines: [],
      suggestionBlocks: 0,
    };
    expect(renderThread(t)).toBe('# Review summary — Copilot, 2025-01-15 12:00\n\nLooks good overall, two suggestions');
    expect(renderThread(t, { labelFor: () => false })).toBe('# Review summary — copilot-pull-request-reviewer[bot], 2025-01-15 12:00\n\nLooks good overall, two suggestions');
    const edited = { ...t, comments: [{ ...t.comments[0], status: 'new' as const }] };
    expect(renderThread(edited)).toBe('# Review summary — Copilot, 2025-01-15 12:00\n\n**Copilot (new):**\n\nLooks good overall, two suggestions');
  });

  it('converts details and summary elements', () => {
    const div = document.createElement('div');
    div.innerHTML = '<details><summary>3 closed items</summary><ul><li>a</li></ul></details>';
    expect(htmlToMarkdown(div)).toBe('**3 closed items**\n\n- a');
  });
});

