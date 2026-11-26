import { beforeEach, describe, expect, it } from 'vitest';
import { InspectSession, MARK_ATTR } from '../inspect/session';
import { LocatorRegistry } from '../locators/registry';
import type { LocatorOverride } from '../locators/types';
import type { DoctorReport } from '../doctor/checks';
import { createPageHandler, worsened } from './handler';

function setup() {
  const reg = new LocatorRegistry();
  const saved: Record<string, LocatorOverride>[] = [];
  const handle = createPageHandler({
    reg,
    session: new InspectSession(),
    persist: async o => void saved.push(o),
    doctor: async () => ({ at: 0, page: 'other', level: 'ok', checks: [], lastCapture: null }),
  });
  return { reg, saved, handle };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('page handler', () => {
  it('selects the marked element and navigates', async () => {
    const { handle } = setup();
    document.body.innerHTML = `<div id="p"><span id="c" ${MARK_ATTR}="1" data-testid="thing"></span></div>`;
    const sel = await handle({ type: 'inspect:select' });
    expect(sel.ok).toBe(true);
    expect(sel.described?.candidates[0].selector).toBe('[data-testid="thing"]');
    const up = await handle({ type: 'inspect:nav', dir: 'parent' });
    expect(up.described?.label).toBe('div#p');
    const none = await handle({ type: 'inspect:nav', dir: 'shadow' });
    expect(none.ok).toBe(false);
  });

  it('explains when nothing reachable is marked', async () => {
    const { handle } = setup();
    const r = await handle({ type: 'inspect:select' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not reachable/);
  });

  it('tests a selector through a shadow path', async () => {
    const { handle } = setup();
    document.body.innerHTML = '<div id="h"></div>';
    document.getElementById('h')!.attachShadow({ mode: 'open' }).innerHTML = '<i class="z"></i><i class="z"></i>';
    expect((await handle({ type: 'inspect:test', selector: 'i.z', shadowPath: ['#h'] })).count).toBe(2);
    expect((await handle({ type: 'inspect:test', selector: 'i.z', shadowPath: [] })).count).toBe(2);
  });

  it('saves and resets overrides, validating input', async () => {
    const { handle, reg, saved } = setup();
    const ok = await handle({ type: 'inspect:save', key: 'thread.path', selector: 'a.x', shadowPath: ['#h'] });
    expect(ok.ok).toBe(true);
    expect(reg.getOverrides()['thread.path']).toEqual({ selectors: ['a.x'], shadowPath: ['#h'] });
    expect(saved).toHaveLength(1);

    expect((await handle({ type: 'inspect:save', key: 'nope', selector: 'a', shadowPath: [] })).ok).toBe(false);
    expect((await handle({ type: 'inspect:save', key: 'thread.path', selector: '[', shadowPath: [] })).message).toBe('Invalid selector');
    expect(saved).toHaveLength(1);

    await handle({ type: 'inspect:reset', key: 'thread.path' });
    expect(reg.getOverrides()['thread.path']).toBeUndefined();
  });

  it('runs the doctor', async () => {
    const { handle } = setup();
    expect((await handle({ type: 'doctor:run' })).report?.level).toBe('ok');
  });

  it('verifies the save in storage and says so', async () => {
    const reg = new LocatorRegistry();
    let store: Record<string, LocatorOverride> = {};
    document.body.innerHTML = '<a class="x"></a><a class="x"></a>';
    const handle = createPageHandler({
      reg,
      session: new InspectSession(),
      persist: async o => void (store = o),
      readBack: async () => store,
      doctor: async () => ({ at: 0, page: 'other', level: 'ok', checks: [], lastCapture: null }),
    });
    const r = await handle({ type: 'inspect:save', key: 'thread.path', selector: 'a.x', shadowPath: [] });
    expect(r).toEqual({ ok: true, message: 'Saved pattern for thread.path; it matches 2 element(s) on this page (verified in storage)' });
    expect((await handle({ type: 'inspect:reset', key: 'thread.path' })).message).toBe('Reset thread.path to default (verified in storage)');
  });

  it('reports a save that storage did not keep', async () => {
    const reg = new LocatorRegistry();
    const handle = createPageHandler({
      reg,
      session: new InspectSession(),
      persist: async () => undefined,
      readBack: async () => ({}),
      doctor: async () => ({ at: 0, page: 'other', level: 'ok', checks: [], lastCapture: null }),
    });
    const r = await handle({ type: 'inspect:save', key: 'thread.path', selector: 'a.x', shadowPath: [] });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/did not keep it/);
  });

  describe('safety net', () => {
    const THREAD = `<review-thread-collapsible><a class="text-mono" href="#xR9">f</a><button class="review-thread-chevron" aria-expanded="true"></button>
      <div class="review-comment"><a class="author">sam</a><button data-testid="comment-header-hamburger"></button><div class="comment-body">hi</div></div></review-thread-collapsible>`;
    const build = () => {
      const reg = new LocatorRegistry();
      const store: { v: Record<string, LocatorOverride> } = { v: {} };
      document.documentElement.setAttribute('data-prc-hook', '1');
      const handle = createPageHandler({
        reg,
        session: new InspectSession(),
        persist: async o => void (store.v = o),
        readBack: async () => store.v,
        doctor: async () => ({ at: 0, page: 'other', level: 'ok', checks: [], lastCapture: null }),
        pathname: () => '/o/r/pull/1',
      });
      return { reg, handle };
    };

    it('warns and offers undo when a save makes the Doctor worse (the wrong element saved under the wrong key)', async () => {
      document.body.innerHTML = THREAD;
      const { reg, handle } = build();
      const r = await handle({ type: 'inspect:save', key: 'thread.all', selector: 'button[data-testid="comment-header-hamburger"]', shadowPath: [] });
      expect(r.ok).toBe(true);
      expect(r.warning).toMatch(/made \d+ Doctor check\(s\) worse: .*File path link/);
      expect(r.undo).toEqual({ key: 'thread.all', previous: null });
      expect(reg.getOverrides()['thread.all']).toBeDefined();

      const undone = await handle({ type: 'inspect:restore', key: 'thread.all', previous: r.undo!.previous });
      expect(undone.ok).toBe(true);
      expect(reg.getOverrides()['thread.all']).toBeUndefined();
    });

    it('restores the previous selector after a harmful save, and stays quiet when a save is harmless', async () => {
      document.body.innerHTML = THREAD;
      const { reg, handle } = build();
      const good = await handle({ type: 'inspect:save', key: 'thread.all', selector: 'review-thread-collapsible', shadowPath: [] });
      expect(good.warning).toBeUndefined();
      const harmless = await handle({ type: 'inspect:save', key: 'comment.menu.react', selector: 'span.nothing', shadowPath: [] });
      expect(harmless.warning).toBeUndefined();

      const bad = await handle({ type: 'inspect:save', key: 'thread.all', selector: 'button[data-testid="comment-header-hamburger"]', shadowPath: [] });
      expect(bad.undo?.previous).toEqual({ selectors: ['review-thread-collapsible'] });
      await handle({ type: 'inspect:restore', key: 'thread.all', previous: bad.undo!.previous });
      expect(reg.getOverrides()['thread.all']).toEqual({ selectors: ['review-thread-collapsible'] });
    });

    it('worsened() only reports checks that got worse', () => {
      const rep = (checks: [string, 'ok' | 'warn' | 'fail'][]): DoctorReport => ({
        at: 0, page: 'conversation', level: 'ok', lastCapture: null,
        checks: checks.map(([id, status]) => ({ id, label: id.toUpperCase(), status, detail: '' })),
      });
      expect(worsened(rep([['a', 'ok'], ['b', 'warn'], ['c', 'fail']]), rep([['a', 'warn'], ['b', 'fail'], ['c', 'fail'], ['d', 'warn']]))).toEqual(['A', 'B', 'D']);
      expect(worsened(rep([['a', 'fail']]), rep([['a', 'ok']]))).toEqual([]);
    });
  });
});

