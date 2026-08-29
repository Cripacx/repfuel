import { describe, expect, it } from 'vitest';
import { computeActivityStats, weekStart } from '../services/activity.js';

/** 2026-08-27 ist ein Donnerstag; die Woche beginnt am Montag, 2026-08-24. */
const NOW = new Date('2026-08-27T12:00:00.000Z');

function workout(startedAt: string, finishedAt: string | null = null) {
  return { startedAt: new Date(startedAt), finishedAt: finishedAt ? new Date(finishedAt) : null };
}

describe('weekStart', () => {
  it('maps every weekday to the monday of its ISO week', () => {
    expect(weekStart(new Date('2026-08-27T12:00:00.000Z'))).toBe('2026-08-24');
    expect(weekStart(new Date('2026-08-24T00:00:00.000Z'))).toBe('2026-08-24');
    // Sonntag gehört noch zur Vorwoche, nicht zur folgenden.
    expect(weekStart(new Date('2026-08-30T23:59:00.000Z'))).toBe('2026-08-24');
    expect(weekStart(new Date('2026-08-31T00:00:00.000Z'))).toBe('2026-08-31');
  });
});

describe('computeActivityStats', () => {
  it('sums minutes per day and counts unfinished workouts as zero minutes', () => {
    const stats = computeActivityStats(
      [
        workout('2026-08-26T10:00:00.000Z', '2026-08-26T11:00:00.000Z'),
        workout('2026-08-26T18:00:00.000Z', '2026-08-26T18:30:00.000Z'),
        workout('2026-08-27T10:00:00.000Z'),
      ],
      NOW,
    );
    const byDate = new Map(stats.days.map((d) => [d.date, d.minutes]));
    expect(byDate.get('2026-08-26')).toBe(90);
    expect(byDate.get('2026-08-27')).toBe(0);
    expect(stats.totalWorkouts).toBe(3);
  });

  it('counts consecutive weeks and keeps the streak while the current week is still empty', () => {
    // Vorwoche und die davor trainiert, diese Woche noch nicht.
    const stats = computeActivityStats(
      [workout('2026-08-18T10:00:00.000Z'), workout('2026-08-11T10:00:00.000Z')],
      NOW,
    );
    expect(stats.weekStreak).toBe(2);
    expect(stats.workoutsThisWeek).toBe(0);
  });

  it('breaks the streak on a skipped week', () => {
    const stats = computeActivityStats(
      [workout('2026-08-24T10:00:00.000Z'), workout('2026-08-10T10:00:00.000Z')],
      NOW,
    );
    expect(stats.weekStreak).toBe(1);
  });

  it('counts this month and this week separately', () => {
    const stats = computeActivityStats(
      [
        workout('2026-08-24T10:00:00.000Z'),
        workout('2026-08-03T10:00:00.000Z'),
        workout('2026-07-30T10:00:00.000Z'),
      ],
      NOW,
    );
    expect(stats.workoutsThisMonth).toBe(2);
    expect(stats.workoutsThisWeek).toBe(1);
  });

  it('returns a gapless ascending day series covering the requested weeks', () => {
    const stats = computeActivityStats([], NOW, 4);
    // Genau vier vollständige Wochenspalten, endend mit dem Sonntag der
    // laufenden Woche — die Heatmap zeichnet nur ganze Spalten.
    expect(stats.days).toHaveLength(4 * 7);
    expect(stats.days[0]?.date).toBe('2026-08-03');
    expect(stats.days.at(-1)?.date).toBe('2026-08-30');
    const dates = stats.days.map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
    expect(stats.weekStreak).toBe(0);
  });
});
