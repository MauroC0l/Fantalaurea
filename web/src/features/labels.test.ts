import { describe, expect, it } from 'vitest';
import { describeDevice, formatRelative } from './labels';

describe('formatRelative', () => {
  const now = new Date(2026, 9, 2, 23, 30);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it('speaks like a social network for recent moments', () => {
    expect(formatRelative(ago(0), now)).toBe('adesso');
    expect(formatRelative(ago(5), now)).toBe('5 min fa');
    expect(formatRelative(ago(130), now)).toBe('2 h fa');
  });

  it('falls back to the time of day for older moments', () => {
    expect(formatRelative(ago(7 * 60), now)).toBe('16:30');
  });
});

describe('describeDevice', () => {
  it('turns user agents into something readable', () => {
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari');
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36')).toBe('Android · Chrome');
    expect(describeDevice('')).toBe('Dispositivo sconosciuto');
  });
});
