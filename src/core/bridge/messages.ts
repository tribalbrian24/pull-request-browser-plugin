import type { DoctorReport } from '../doctor/checks';
import type { LocatorOverride } from '../locators/types';
import type { Described, NavDir } from '../inspect/session';

export type PageMsg =
  | { type: 'doctor:run' }
  | { type: 'diagnostics:run' }
  | { type: 'inspect:select' }
  | { type: 'inspect:nav'; dir: NavDir }
  | { type: 'inspect:test'; selector: string; shadowPath: string[] }
  | { type: 'inspect:save'; key: string; selector: string; shadowPath: string[] }
  | { type: 'inspect:reset'; key: string }
  | { type: 'inspect:restore'; key: string; previous: LocatorOverride | null };

export type BgMsg =
  | { type: 'doctor:report'; report: DoctorReport }
  | { type: 'relay'; tabId: number; payload: PageMsg }
  | { type: 'fetch-file'; repo: string; ref: string; path: string };

export interface FetchReply {
  ok: boolean;
  text?: string;
  reason?: 'permission' | 'not-found' | 'error';
  message?: string;
}

export interface Reply {
  ok: boolean;
  message?: string;
  described?: Described | null;
  count?: number;
  report?: DoctorReport;
  text?: string;
  warning?: string;
  /** What to send back as inspect:restore to undo the last save. */
  undo?: { key: string; previous: LocatorOverride | null };
}
