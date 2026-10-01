import { addDays, addDaysToKey, fromDateKey, lastNDayKeys, lastNDaysRange, startOfDay, toDateKey } from '../dates';

// Tests run with TZ=America/New_York (see package.json) so DST transitions are deterministic.
describe('dates', () => {
  it('formats local date keys with zero padding', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('round-trips keys to local midnight', () => {
    const d = fromDateKey('2026-09-30');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 30, 0]);
  });

  it('rejects malformed or impossible keys', () => {
    expect(() => fromDateKey('2026-9-30')).toThrow();
    expect(() => fromDateKey('2026-02-30')).toThrow();
  });

  it('returns the last N days oldest-first including today', () => {
    expect(lastNDayKeys(3, new Date(2026, 8, 30, 8))).toEqual(['2026-09-28', '2026-09-29', '2026-09-30']);
  });

  it('crosses month and year boundaries', () => {
    expect(lastNDayKeys(3, new Date(2026, 0, 1, 12))).toEqual(['2025-12-30', '2025-12-31', '2026-01-01']);
  });

  it('is DST-safe when clocks spring forward (23-hour day)', () => {
    // US DST began 8 March 2026.
    expect(lastNDayKeys(3, new Date(2026, 2, 9, 0, 30))).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
    expect(addDaysToKey('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('is DST-safe when clocks fall back (25-hour day)', () => {
    // US DST ended 1 November 2026.
    expect(addDaysToKey('2026-11-01', 1)).toBe('2026-11-02');
    expect(toDateKey(addDays(new Date(2026, 10, 1, 0, 0), 1))).toBe('2026-11-02');
  });

  it('builds a query range from local midnight N-1 days ago to now', () => {
    const now = new Date(2026, 8, 30, 15, 45);
    const { start, end } = lastNDaysRange(7, now);
    expect(start).toEqual(startOfDay(new Date(2026, 8, 24)));
    expect(end).toBe(now);
  });
});
