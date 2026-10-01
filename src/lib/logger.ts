/**
 * Diagnostic logger. Health values must never be logged: callers pass an
 * event name, the error, and optional *non-health* context (counts, flags,
 * provider names). Only the error's class name and a truncated message are
 * recorded, and logs stay on-device (console in development only).
 */

type SafeContext = Record<string, string | number | boolean>;

export interface LogEntry {
  level: 'warn' | 'error';
  event: string;
  error?: string;
  context?: SafeContext;
  at: string;
}

const MAX_ENTRIES = 50;
const entries: LogEntry[] = [];

function describe(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message.slice(0, 200)}`;
  }
  return typeof error;
}

function record(level: LogEntry['level'], event: string, error?: unknown, context?: SafeContext) {
  const entry: LogEntry = { level, event, at: new Date().toISOString() };
  if (error !== undefined) entry.error = describe(error);
  if (context) entry.context = context;
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  if (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.NODE_ENV !== 'test') {
    console[level](`[EdgeFit] ${event}`, entry.error ?? '', context ?? '');
  }
}

export const logger = {
  warn: (event: string, error?: unknown, context?: SafeContext) => record('warn', event, error, context),
  error: (event: string, error?: unknown, context?: SafeContext) => record('error', event, error, context),
  /** Recent entries, for tests and an on-device diagnostics view. */
  recent: (): readonly LogEntry[] => [...entries],
  clear: () => {
    entries.length = 0;
  },
};
