import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';

// Mirrors the --duration-* tokens: Svelte transitions need numbers, not CSS variables.
const DURATIONS = { fast: 140, base: 260, slow: 650 } as const;

export function duration(speed: keyof typeof DURATIONS): number {
  return prefersReducedMotion.current ? 0 : DURATIONS[speed];
}

export function stagger(index: number, step = 45): number {
  return prefersReducedMotion.current ? 0 : Math.min(index, 10) * step;
}

export const easing = cubicOut;
