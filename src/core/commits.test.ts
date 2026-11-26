import { beforeEach, describe, expect, it } from 'vitest';
import { commitsMarkdown, headSha, openAndReadCommits, readCommitList, selectedRange } from './commits';
import { LocatorRegistry } from './locators/registry';

const li = (n: string, selected: boolean, label: string, desc: string, sha: string) => `
<li tabindex="-1" aria-selected="${selected}" role="option" id="_r_${n}_" data-component="ActionList.Item">
  <div><span><span data-component="ActionList.Item--DividerContainer"><div>
    <span id="_r_${n}_--label" data-component="ActionList.Item.Label">${label}</span><span id="_r_${n}_--block-description" data-component="ActionList.Description">${desc}</span>
  </div><span data-component="ActionList.TrailingVisual" id="_r_${n}_--trailing-visual">${sha}</span></span></span></div>
</li>`;

const LIST = `<ul aria-label="Select a range of commits" role="group">
${li('a', true, 'Refactor the parser into smaller functions and add tests for the e…', 'alice committed yesterday', 'a1b2c3d')}
${li('b', true, 'Fix a typo in the install steps', 'alice committed yesterday', 'b2c3d4e')}
${li('c', false, 'Add tests for the parser', 'alice committed 1 hour ago', 'c3d4e5f')}
<li role="option"><span data-component="ActionList.Item.Label">All commits</span></li>
</ul>`;

const reg = new LocatorRegistry();

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('readCommitList', () => {
  it('parses sha, subject, author/time and selection, skipping non-commit options', () => {
    document.body.innerHTML = LIST;
    const items = readCommitList(reg);
    expect(items).toEqual([
      { sha: 'a1b2c3d', label: 'Refactor the parser into smaller functions and add tests for the e…', description: 'alice committed yesterday', selected: true, truncated: true },
      { sha: 'b2c3d4e', label: 'Fix a typo in the install steps', description: 'alice committed yesterday', selected: true, truncated: false },
      { sha: 'c3d4e5f', label: 'Add tests for the parser', description: 'alice committed 1 hour ago', selected: false, truncated: false },
    ]);
    expect(headSha(items)).toBe('c3d4e5f');
    expect(selectedRange(items).count).toBe(2);
    expect(selectedRange(items).first?.sha).toBe('a1b2c3d');
    expect(selectedRange(items).last?.sha).toBe('b2c3d4e');
  });

  it('returns nothing when the picker is closed', () => {
    expect(readCommitList(reg)).toEqual([]);
    expect(headSha([])).toBeNull();
  });

  it('renders a markdown list and flags truncated subjects', () => {
    document.body.innerHTML = LIST;
    const md = commitsMarkdown(readCommitList(reg)).split('\n');
    expect(md[0]).toBe('- `a1b2c3d` Refactor the parser into smaller functions and add tests for the e… (subject truncated by GitHub) — alice committed yesterday');
    expect(md[1]).toBe('- `b2c3d4e` Fix a typo in the install steps — alice committed yesterday');
  });
});

describe('openAndReadCommits', () => {
  it('opens the picker when closed, reads it, and returns the commits', async () => {
    document.body.innerHTML = '<button id="changes-selector-button">All commits</button><div id="portal"></div>';
    document.getElementById('changes-selector-button')!.addEventListener('click', () => {
      document.getElementById('portal')!.innerHTML = LIST;
    });
    const items = await openAndReadCommits(reg);
    expect(items.map(i => i.sha)).toEqual(['a1b2c3d', 'b2c3d4e', 'c3d4e5f']);
  });

  it('reads an already open picker without clicking the button', async () => {
    let clicks = 0;
    document.body.innerHTML = `<button id="changes-selector-button">x</button>${LIST}`;
    document.getElementById('changes-selector-button')!.addEventListener('click', () => clicks++);
    expect(await openAndReadCommits(reg)).toHaveLength(3);
    expect(clicks).toBe(0);
  });

  it('returns an empty list when there is no picker button', async () => {
    expect(await openAndReadCommits(reg)).toEqual([]);
  });
});
