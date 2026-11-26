/** The settings that decide WHICH comments a capture contains. A remembered capture is only comparable with one made the same way. */
export interface CaptureScope {
  includeResolved: boolean;
  includeReviews: boolean;
  excluded: string[];
}

export const scopeSig = (s: CaptureScope): string =>
  `resolved:${s.includeResolved ? 'yes' : 'no'}|reviews:${s.includeReviews ? 'yes' : 'no'}|skip:${[...s.excluded].sort().join('+') || 'none'}`;

export const snapshotKey = (pr: string, s: CaptureScope): string => `${pr}|${scopeSig(s)}`;

export const snapshotPrefix = (pr: string): string => `${pr}|`;
