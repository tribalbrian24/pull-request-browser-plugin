import { beforeEach, describe, expect, it } from 'vitest';
import { LocatorRegistry, parseOverrides } from './registry';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('LocatorRegistry', () => {
  it('uses defaults when there is no override', () => {
    document.body.innerHTML = '<a class="text-mono">x</a>';
    expect(new LocatorRegistry().first('thread.path')?.textContent).toBe('x');
  });

  it('prefers an override, then falls back to the default', () => {
    document.body.innerHTML = '<a class="text-mono">x</a><a class="custom">y</a>';
    const reg = new LocatorRegistry();
    reg.setOverrides({ 'thread.path': { selectors: ['a.custom'] } });
    expect(reg.first('thread.path')?.textContent).toBe('y');
    reg.setOverrides({ 'thread.path': { selectors: ['a.missing'] } });
    expect(reg.first('thread.path')?.textContent).toBe('x');
  });

  it('does not fall back when replaceDefaults is set', () => {
    document.body.innerHTML = '<a class="text-mono">x</a>';
    const reg = new LocatorRegistry();
    reg.setOverrides({ 'thread.path': { selectors: ['a.missing'], replaceDefaults: true } });
    expect(reg.resolve('thread.path').source).toBe('none');
  });

  it('pierces shadow roots via shadowPath', () => {
    document.body.innerHTML = '<div id="h"></div>';
    document.getElementById('h')!.attachShadow({ mode: 'open' }).innerHTML = '<button class="b">go</button>';
    const reg = new LocatorRegistry();
    reg.setOverrides({ 'thread.chevron': { selectors: ['button.b'], shadowPath: ['#h'] } });
    const r = reg.resolve('thread.chevron');
    expect(r.source).toBe('override');
    expect(r.elements[0].textContent).toBe('go');
  });

  it('falls back to a deep search for default selectors inside shadow roots', () => {
    document.body.innerHTML = '<div id="h"></div>';
    document.getElementById('h')!.attachShadow({ mode: 'open' }).innerHTML = '<a class="text-mono">deep</a>';
    expect(new LocatorRegistry().first('thread.path')?.textContent).toBe('deep');
  });

  it('applies the text filter', () => {
    document.body.innerHTML = '<div>Comment on lines +1 to +2</div><span>other</span>';
    expect(new LocatorRegistry().all('thread.rangeHeader')).toHaveLength(1);
  });

  it('does not apply the default text filter to an override', () => {
    document.body.innerHTML = '<div class="mine">something else</div>';
    const reg = new LocatorRegistry();
    reg.setOverrides({ 'thread.rangeHeader': { selectors: ['div.mine'] } });
    const r = reg.resolve('thread.rangeHeader');
    expect(r.source).toBe('override');
    expect(r.elements).toHaveLength(1);
  });

  it('tracks match counts for health reporting', () => {
    document.body.innerHTML = '<a class="text-mono">x</a>';
    const reg = new LocatorRegistry();
    reg.first('thread.path');
    reg.first('thread.all');
    expect(reg.report()).toEqual({ 'thread.path': 1, 'thread.all': 0 });
  });

  it('closest honours the override first', () => {
    document.body.innerHTML = '<div class="js-comment"><div class="mine"><span id="s"></span></div></div>';
    const reg = new LocatorRegistry();
    expect(reg.closest('comment.container', document.getElementById('s')!)?.className).toBe('js-comment');
    reg.setOverrides({ 'comment.container': { selectors: ['.mine'] } });
    expect(reg.closest('comment.container', document.getElementById('s')!)?.className).toBe('mine');
  });
});

describe('parseOverrides', () => {
  it('accepts a valid pack', () => {
    const { value, errors } = parseOverrides('{"thread.path":{"selectors":["a.x"],"shadowPath":["#h"]}}');
    expect(errors).toEqual([]);
    expect(value['thread.path']).toEqual({ selectors: ['a.x'], shadowPath: ['#h'] });
  });
  it('rejects unknown keys, bad selectors and bad JSON', () => {
    expect(parseOverrides('{"nope":{"selectors":["a"]}}').errors[0]).toMatch(/Unknown key/);
    expect(parseOverrides('{"thread.path":{"selectors":["["]}}').errors[0]).toMatch(/invalid selectors/);
    expect(parseOverrides('{"constructor":{"selectors":["a"]}}').errors[0]).toMatch(/Unknown key/);
    expect(parseOverrides('{').errors).toEqual(['Invalid JSON']);
  });
});
