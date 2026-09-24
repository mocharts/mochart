import { describe, it, expect } from 'vitest';
import { getPeriodStart, getNextPeriodStart, getPeriodIndex, getPeriodBoundaries } from '../../src/data/Steps';

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
