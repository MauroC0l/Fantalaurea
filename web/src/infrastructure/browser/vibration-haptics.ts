import type { HapticPattern, Haptics } from '../../application/ports';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 12,
  warning: [24, 60, 24],
};

/** iOS Safari has no Vibration API: there this is a silent no-op. */
export function vibrationHaptics(): Haptics {
  return {
    pulse(pattern) {
      if ('vibrate' in navigator) navigator.vibrate(PATTERNS[pattern]);
    },
  };
}
