import { buildCalendarDays } from '@/domain/calendar';
import type { ThemeColors } from '../theme';
import { cellColors, scaleSwatches, toMonthGrid } from '../components/ActivityCalendar';

// Tests run with TZ=America/New_York (see package.json).
describe('toMonthGrid', () => {
  it('lays the 30 days out Monday-first, padded to whole weeks', () => {
    // Window: Fri 18 Sep → Sat 17 Oct 2026.
    const days = buildCalendarDays(new Date(2026, 9, 17, 9), [], []);
    const cells = toMonthGrid(days);

    expect(cells.length % 7).toBe(0);
    expect(cells).toHaveLength(35);
    // Fri is the 5th column, so four leading blanks; Sat 17 Oct is followed by one blank Sunday.
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]!.date).toBe('2026-09-18');
    expect(cells[33]).toMatchObject({ date: '2026-10-17', isToday: true });
    expect(cells[34]).toBeNull();
    expect(cells.filter((c) => c !== null).map((c) => c!.date)).toEqual(days.map((d) => d.date));
  });

  it('puts every day under its weekday column, across month, year and DST boundaries', () => {
    for (const now of [new Date(2026, 9, 17, 9), new Date(2026, 0, 10, 12), new Date(2026, 10, 15, 9), new Date(2026, 2, 20, 9)]) {
      toMonthGrid(buildCalendarDays(now, [], [])).forEach((day, i) => {
        if (day) expect((new Date(`${day.date}T12:00:00`).getDay() + 6) % 7).toBe(i % 7);
      });
    }
  });

  it('needs no leading blanks when the window starts on a Monday', () => {
    // Window: Mon 28 Sep → Tue 27 Oct 2026.
    const cells = toMonthGrid(buildCalendarDays(new Date(2026, 9, 27, 9), [], []));
    expect(cells[0]!.date).toBe('2026-09-28');
    expect(cells).toHaveLength(35);
  });
});

describe('cellColors', () => {
  const colors = { accent: '#6100ED', surfaceMuted: '#EEEEEE', chartEmpty: '#BEBEBE', text: '#0E0D12', textMuted: '#5A5962', onAccent: '#FFFFFF' } as ThemeColors;

  it('unknown is an unfilled dashed outline; a valid zero is a solid neutral tile', () => {
    expect(cellColors('unknown', colors, false)).toMatchObject({ background: 'transparent', borderStyle: 'dashed' });
    expect(cellColors('zero', colors, false)).toMatchObject({ background: '#EEEEEE', borderStyle: 'solid' });
  });

  it('the legend strip runs from the zero tile to solid accent, with five distinct steps', () => {
    for (const dark of [false, true]) {
      const swatches = scaleSwatches(colors, dark);
      expect(swatches).toHaveLength(5);
      expect(new Set(swatches).size).toBe(5);
      expect(swatches[0]).toBe('#EEEEEE');
      expect(swatches[4]).toBe('#6100ED');
    }
  });
});
