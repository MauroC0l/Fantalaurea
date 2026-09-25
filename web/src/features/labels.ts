import type { ActionKind, Difficulty, PhotoPolicy } from '../domain/action';

export const KIND_LABELS: Readonly<Record<ActionKind, string>> = {
  bonus: 'Bonus',
  malus: 'Malus',
  common: 'Per tutti',
};

export const PHOTO_POLICY_LABELS: Readonly<Record<PhotoPolicy, string>> = {
  none: 'Nessuna',
  optional: 'Facoltativa',
  required: 'Obbligatoria',
};

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  soft: 'Soft',
  medium: 'Medium',
  hard: 'Hard',
};

export const DIFFICULTY_LEVELS: Readonly<Record<Difficulty, 1 | 2 | 3>> = { soft: 1, medium: 2, hard: 3 };

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** "adesso", "5 min fa", "2 h fa", otherwise the time of day. */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;
  if (minutes < 6 * 60) return `${Math.floor(minutes / 60)} h fa`;
  return formatTime(date);
}

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/Linux/, 'Linux'],
];

// Order matters: most user agents also mention Safari and Chrome.
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Firefox|FxiOS/, 'Firefox'],
  [/Chrome|CriOS/, 'Chrome'],
  [/Safari/, 'Safari'],
];

/** "iPhone · Safari" from a browser user agent: enough to recognise your own phone. */
export function describeDevice(userAgent: string): string {
  const match = (list: readonly (readonly [RegExp, string])[]) => list.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = match(SYSTEMS) ?? 'Dispositivo sconosciuto';
  const browser = match(BROWSERS);
  return browser ? `${system} · ${browser}` : system;
}
