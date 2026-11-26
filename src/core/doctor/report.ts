import { browser } from 'wxt/browser';
import type { BgMsg } from '../bridge/messages';
import { registry } from '../instance';
import type { DoctorReport } from './checks';
import { runDoctorWithRetry } from './retry';
import { getLastCapture, setDoctorLevel } from './state';

export async function reportDoctor(): Promise<DoctorReport> {
  const report = await runDoctorWithRetry(registry, { lastCapture: getLastCapture() }, { onRetry: () => setDoctorLevel(null) });
  setDoctorLevel(report.level);
  try {
    await browser.runtime.sendMessage({ type: 'doctor:report', report } satisfies BgMsg);
  } catch {
    /* background asleep or extension reloaded */
  }
  return report;
}
