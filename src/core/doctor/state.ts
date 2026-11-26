import type { Issue } from '../capture/validate';

let last: Issue[] | null = null;

export const setLastCapture = (issues: Issue[] | null) => {
  last = issues;
};
export const getLastCapture = () => last;

export type DoctorLevel = 'ok' | 'warn' | 'error' | null;

let level: DoctorLevel = null;
const subscribers = new Set<() => void>();

export const getDoctorLevel = () => level;
export const setDoctorLevel = (next: DoctorLevel) => {
  level = next;
  subscribers.forEach(fn => fn());
};
export const subscribeDoctor = (fn: () => void) => {
  subscribers.add(fn);
  return () => void subscribers.delete(fn);
};
