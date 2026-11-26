import { retryBackoff, sleep } from '../dom';
import type { LocatorRegistry } from '../locators/registry';
import { runDoctor, type DoctorOpts, type DoctorReport } from './checks';

/** 250ms, 500ms, 1s, 2s, 3s: five retries, about 6.75 seconds in total. */
export const DOCTOR_DELAYS = [250, 500, 1000, 2000, 3000];

export interface DoctorRetryOpts {
  delays?: number[];
  sleep?: (ms: number) => Promise<void>;
  /** Called before each wait, so the caller can show "checking" instead of an old verdict. */
  onRetry?: (attempt: number) => void;
}

const hasProblems = (r: DoctorReport) => r.page !== 'other' && r.checks.some(c => c.status === 'fail' || c.status === 'warn');

/**
 * Runs the Doctor and, while any check is not ok, runs it again with incremental back off (up to five retries).
 * A page that is still loading therefore settles to green; red survives only when the selectors keep failing.
 */
export async function runDoctorWithRetry(reg: LocatorRegistry, opts: DoctorOpts = {}, retry: DoctorRetryOpts = {}): Promise<DoctorReport> {
  const delays = retry.delays ?? DOCTOR_DELAYS;
  let n = 0;
  const { value, retries } = await retryBackoff(
    () => runDoctor(reg, opts),
    r => !hasProblems(r),
    delays,
    async ms => {
      retry.onRetry?.(++n);
      await (retry.sleep ?? sleep)(ms);
    },
  );
  return { ...value, retries };
}
