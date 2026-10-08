import { describe, it, expect } from 'vitest';
import { getPeriodStart, getNextPeriodStart, getPeriodIndex, getPeriodBoundaries, getKeptPeriodStarts } from '../../src/data/Steps';

const HOUR = 3600000;

/** Run with the process zone set, restoring it after: Node reads TZ on every Date call. */
function inZone(tz: string, run: () => void): void {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    run();
  }
  finally {
    process.env.TZ = previous;
  }
}

describe('clock periods', () => {
  const date = new Date('2026-06-01T10:15:30.250Z');

  it('start on their boundary in UTC', () => {
    expect(getPeriodStart('hour', true, date).toISOString()).toBe('2026-06-01T10:00:00.000Z');
    expect(getPeriodStart('minute', true, date).toISOString()).toBe('2026-06-01T10:15:00.000Z');
    expect(getPeriodStart('second', true, date).toISOString()).toBe('2026-06-01T10:15:30.000Z');
  });

  it('step by their fixed length', () => {
    expect(getNextPeriodStart('hour', true, getPeriodStart('hour', true, date)).toISOString()).toBe('2026-06-01T11:00:00.000Z');
    expect(getNextPeriodStart('minute', true, getPeriodStart('minute', true, date)).toISOString()).toBe('2026-06-01T10:16:00.000Z');
    expect(getNextPeriodStart('second', true, getPeriodStart('second', true, date)).toISOString()).toBe('2026-06-01T10:15:31.000Z');
  });

  it('index consecutively from the epoch', () => {
    const start = getPeriodStart('hour', true, date);
    expect(getPeriodIndex('hour', true, start)).toBe(Date.UTC(2026, 5, 1, 10) / HOUR);
    expect(getPeriodIndex('hour', true, getNextPeriodStart('hour', true, start))).toBe(getPeriodIndex('hour', true, start) + 1);
  });

  it('start on the local hour in a zone offset by a fraction of an hour', () => {
    inZone('Asia/Kolkata', () => {
      // 10:15 IST is 04:45Z; the local hour starts at 10:00 IST, 04:30Z
      expect(getPeriodStart('hour', false, new Date('2026-06-01T04:45:00Z')).toISOString()).toBe('2026-06-01T04:30:00.000Z');
      expect(getPeriodStart('hour', true, new Date('2026-06-01T04:45:00Z')).toISOString()).toBe('2026-06-01T04:00:00.000Z');
    });
  });

  it('neither repeat nor skip an hour boundary across a daylight saving change', () => {
    inZone('America/New_York', () => {
      // the zone springs forward at 02:00 on March 8 2026, so the local hours are 00, 01, 03, 04, 05
      const boundaries = getPeriodBoundaries('hour', false, [new Date('2026-03-08T00:00:00'), new Date('2026-03-08T05:00:00')]);
      expect(boundaries.map(boundary => boundary.getHours())).toEqual([0, 1, 3, 4, 5]);
      expect(new Set(boundaries.map(boundary => getPeriodIndex('hour', false, boundary))).size).toBe(5);
    });
  });
});

// every period was visited and filtered, so a second step with count 10000000 walked the 31 million seconds of a year
describe('getKeptPeriodStarts', () => {
  const visited = (period: 'second' | 'minute' | 'hour' | 'day', dateUTC: boolean, start: Date, end: Date, count: number, offset: number) => {
    const kept: number[] = [];
    for (let boundary = getPeriodStart(period, dateUTC, start); boundary.getTime() <= end.getTime(); boundary = getNextPeriodStart(period, dateUTC, boundary)) {
      const index = getPeriodIndex(period, dateUTC, boundary);
      if (((index - offset) % count + count) % count === 0) {
        kept.push(boundary.getTime());
      }
    }
    return kept;
  };

  it('keeps the periods a walk over every period keeps', () => {
    inZone('Asia/Kolkata', () => {
      const start = new Date('2026-06-01T04:45:10Z');
      const end = new Date('2026-06-03T07:00:00Z');
      for (const [period, count, offset] of [['second', 7, 3], ['minute', 45, 2], ['hour', 5, 1], ['day', 2, 1]] as const) {
        for (const dateUTC of [true, false]) {
          const kept = getKeptPeriodStarts(period, dateUTC, start, end, count, offset).map(boundary => boundary.getTime());
          expect(kept.length).toBeGreaterThan(0);
          expect(kept).toEqual(visited(period, dateUTC, start, end, count, offset));
        }
      }
    });
  });

  it('jumps between kept clock periods', () => {
    const started = performance.now();
    const kept = getKeptPeriodStarts('second', true, new Date('2024-01-01T00:00:00Z'), new Date('2025-01-01T00:00:00Z'), 10000000, 0);
    expect(performance.now() - started).toBeLessThan(100);
    expect(kept.map(boundary => boundary.getTime() / 1000 % 10000000)).toEqual([0, 0, 0]);
  });
});
