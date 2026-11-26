import { buildDiagnostics } from '../diagnostics';
import { runDoctor, type DoctorReport } from '../doctor/checks';
import type { InspectSession } from '../inspect/session';
import { isLocatorKey } from '../locators/defaults';
import { highlight } from '../locators/inspector';
import { isValidSelector, runAttempt, type LocatorRegistry } from '../locators/registry';
import type { LocatorOverride } from '../locators/types';
import type { PageMsg, Reply } from './messages';

export interface HandlerDeps {
  reg: LocatorRegistry;
  session: InspectSession;
  persist: (overrides: Record<string, LocatorOverride>) => Promise<void>;
  /** Reads storage back so a save that did not stick is reported instead of assumed. */
  readBack?: () => Promise<Record<string, LocatorOverride>>;
  doctor: () => Promise<DoctorReport>;
  pathname?: () => string;
}

const RANK = { warn: 1, fail: 2 } as const;

export function worsened(before: DoctorReport, after: DoctorReport): string[] {
  const was = new Map(before.checks.map(c => [c.id, c.status]));
  return after.checks
    .filter(c => {
      if (c.status !== 'warn' && c.status !== 'fail') return false;
      const prev = was.get(c.id);
      const prevRank = prev === 'warn' || prev === 'fail' ? RANK[prev] : 0;
      return RANK[c.status] > prevRank;
    })
    .map(c => c.label);
}

export function createPageHandler({ reg, session, persist, readBack, doctor, pathname = () => location.pathname }: HandlerDeps) {
  const save = async (next: Record<string, LocatorOverride>, message: string, key: string, expectPresent: boolean): Promise<Reply> => {
    await persist(next);
    reg.setOverrides(next);
    if (readBack) {
      const stored = await readBack();
      if (expectPresent !== (key in stored)) {
        return { ok: false, message: 'Saved, but the browser did not keep it. Is this a temporary or private browser profile?' };
      }
    }
    return { ok: true, message: readBack ? `${message} (verified in storage)` : message };
  };

  return async (msg: PageMsg): Promise<Reply> => {
    switch (msg.type) {
      case 'doctor:run':
        return { ok: true, report: await doctor() };

      case 'diagnostics:run':
        return { ok: true, text: buildDiagnostics(reg).text };

      case 'inspect:select': {
        const el = session.consumeMarked();
        if (!el) {
          return {
            ok: false,
            message: 'Selected node is not reachable (text node, closed shadow root, or another frame). Select its host element.',
          };
        }
        highlight([el], 1200);
        return { ok: true, described: session.describe() };
      }

      case 'inspect:nav': {
        const moved = session.move(msg.dir);
        if (!moved) return { ok: false, message: `No ${msg.dir} element`, described: session.describe() };
        highlight([moved], 1200);
        return { ok: true, described: session.describe() };
      }

      case 'inspect:test': {
        const r = runAttempt({ selectors: [msg.selector], shadowPath: msg.shadowPath }, document);
        highlight(r.elements);
        return { ok: true, count: r.elements.length };
      }

      case 'inspect:save': {
        if (!isLocatorKey(msg.key)) return { ok: false, message: `Unknown locator key: ${msg.key}` };
        if (!isValidSelector(msg.selector) || !msg.shadowPath.every(isValidSelector)) {
          return { ok: false, message: 'Invalid selector' };
        }
        const override: LocatorOverride = {
          selectors: [msg.selector],
          ...(msg.shadowPath.length ? { shadowPath: msg.shadowPath } : {}),
        };
        const previous = reg.getOverrides()[msg.key] ?? null;
        const before = runDoctor(reg, { pathname: pathname() });
        const matches = runAttempt({ selectors: [msg.selector], shadowPath: msg.shadowPath }, document).elements.length;
        const reply = await save(
          { ...reg.getOverrides(), [msg.key]: override },
          `Saved pattern for ${msg.key}; it matches ${matches} element(s) on this page`,
          msg.key,
          true,
        );
        if (!reply.ok) return reply;
        const worse = worsened(before, runDoctor(reg, { pathname: pathname() }));
        return worse.length
          ? {
              ...reply,
              warning: `That made ${worse.length} Doctor check(s) worse: ${worse.join(', ')}. It is probably the wrong element or the wrong locator.`,
              undo: { key: msg.key, previous },
            }
          : reply;
      }

      case 'inspect:restore': {
        if (!isLocatorKey(msg.key)) return { ok: false, message: `Unknown locator key: ${msg.key}` };
        const next = { ...reg.getOverrides() };
        const prev = msg.previous;
        if (prev && Array.isArray(prev.selectors) && prev.selectors.every(isValidSelector)) next[msg.key] = prev;
        else delete next[msg.key];
        return save(next, `Restored ${msg.key}`, msg.key, msg.key in next);
      }

      case 'inspect:reset': {
        const next = { ...reg.getOverrides() };
        delete next[msg.key];
        return save(next, `Reset ${msg.key} to default`, msg.key, false);
      }

      default:
        return { ok: false, message: 'Unknown message' };
    }
  };
}
