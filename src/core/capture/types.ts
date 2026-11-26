export type DeltaStatus = 'new' | 'edited' | 'unchanged';

export interface CapturedComment {
  id: string | null;
  author: string;
  agent?: string;
  agentId?: string;
  status?: DeltaStatus;
  text: string | null;
  reason: string;
  via: string;
}

export interface CapturedThread {
  /** 'review' = a review summary comment (no file path). Defaults to an inline thread. */
  kind?: 'thread' | 'review';
  /** When a review was posted, local time (reviews only). */
  when?: string;
  path: string;
  range: string;
  comments: CapturedComment[];
  suggestionLines: string[];
  suggestionBlocks: number;
  /** Live thread element, kept in memory only (used to mark changes on the page). */
  el?: Element;
}

export interface CaptureResult {
  threads: CapturedThread[];
  expected: number;
  skipped: number;
  excluded: number;
  aborted?: boolean;
  /** Resolved threads on the page that were left out because "Include resolved" is off. */
  resolvedSkipped: number;
}
