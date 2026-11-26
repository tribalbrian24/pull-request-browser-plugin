import { beforeEach, describe, expect, it } from 'vitest';
import { LocatorRegistry } from '../locators/registry';
import { parseLineRange, parseLooseRange, rangeFromHref, suggestionLines, threadRange, threadRangeDetail } from './thread';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('parseLineRange', () => {
  it('parses ranges and single lines', () => {
    expect(parseLineRange('Comment on lines +234 to +236')).toBe('234-236');
    expect(parseLineRange('Comment on line +12')).toBe('12');
    expect(parseLineRange('nothing here')).toBe('');
  });
});

describe('rangeFromHref', () => {
  it('reads the R anchor', () => {
    expect(rangeFromHref('#diff-abcR269')).toBe('269');
    expect(rangeFromHref('#diff-abcR10-R12')).toBe('10-12');
    expect(rangeFromHref('#nothing')).toBe('');
  });
});

describe('threadRange', () => {
  it('prefers the header text', () => {
    document.body.innerHTML = '<div id="t"><div>Comment on lines +5 to +7</div><a class="text-mono" href="#xR9">f</a></div>';
    expect(threadRange(new LocatorRegistry(), document.getElementById('t')!)).toBe('5-7');
  });
  it('falls back to diff rows then href', () => {
    document.body.innerHTML =
      '<div id="t"><table class="diff-table"><tbody><tr><td data-line-number="40"></td><td data-line-number="41"></td></tr></tbody></table></div>';
    expect(threadRange(new LocatorRegistry(), document.getElementById('t')!)).toBe('41');
    document.body.innerHTML = '<div id="t"><a class="text-mono" href="#xR9">f</a></div>';
    expect(threadRange(new LocatorRegistry(), document.getElementById('t')!)).toBe('9');
  });
});

describe('suggestionLines', () => {
  it('keeps line numbers and +/- markers', () => {
    document.body.innerHTML = `<div id="t"><div data-testid="automated-review-suggestion"><table class="unifiedDiffLines__k0eV89"><tbody>
      <tr><td>12</td><td></td><td><span data-diff-text-marker="true">-</span>old code</td></tr>
      <tr><td></td><td>12</td><td><span data-diff-text-marker="true">+</span>new code</td></tr>
    </tbody></table></div></div>`;
    expect(suggestionLines(new LocatorRegistry(), document.getElementById('t')!)).toEqual(['12 -old code', '12 +new code']);
  });
});

describe('parseLooseRange', () => {
  it('reads common range spellings and ignores long numbers', () => {
    expect(parseLooseRange('+234 to +236')).toBe('234-236');
    expect(parseLooseRange('R12-R14')).toBe('12-14');
    expect(parseLooseRange('L7')).toBe('7');
    expect(parseLooseRange('12')).toBe('12');
    expect(parseLooseRange('no numbers')).toBe('');
    expect(parseLooseRange('abc1234567')).toBe('');
  });
});

describe('threadRange with an override', () => {
  const reg = () => {
    const r = new LocatorRegistry();
    r.setOverrides({ 'thread.rangeHeader': { selectors: ['span.mine'] } });
    return r;
  };
  it('uses the chosen element even though it does not say "Comment on lines" and is long', () => {
    document.body.innerHTML = `<div id="t"><span class="mine">+40 to +42 ${'x'.repeat(200)}</span></div>`;
    expect(threadRange(reg(), document.getElementById('t')!)).toBe('40-42');
  });
  it('reads a chosen link', () => {
    document.body.innerHTML = '<div id="t"><span class="mine"><a href="#diff-abcR8-R9">link</a></span></div>';
    expect(threadRange(reg(), document.getElementById('t')!)).toBe('8-9');
  });
  it('falls back to the normal sources if the chosen element has no range', () => {
    document.body.innerHTML = '<div id="t"><span class="mine">nothing</span><a class="text-mono" href="#xR5">f</a></div>';
    expect(threadRange(reg(), document.getElementById('t')!)).toBe('5');
  });
});

describe('threadRangeDetail', () => {
  const reg = () => {
    const r = new LocatorRegistry();
    r.setOverrides({ 'thread.rangeHeader': { selectors: ['button.mistake'] } });
    return r;
  };
  it('still uses the built-in label when a saved selector matches elements with no range', () => {
    document.body.innerHTML = '<div id="t"><button class="mistake"></button><div>Comment on lines +5 to +7</div></div>';
    expect(threadRangeDetail(reg(), document.getElementById('t')!)).toEqual({ range: '5-7', via: 'label', overrideMatched: 1 });
  });
  it('then the code preview, and says where the range came from', () => {
    document.body.innerHTML = '<div id="t"><button class="mistake"></button><table class="diff-table"><tbody><tr><td data-line-number="236"></td></tr></tbody></table></div>';
    expect(threadRangeDetail(reg(), document.getElementById('t')!)).toEqual({ range: '236', via: 'preview', overrideMatched: 1 });
    expect(threadRangeDetail(new LocatorRegistry(), document.getElementById('t')!)).toEqual({ range: '236', via: 'preview', overrideMatched: 0 });
  });
});

