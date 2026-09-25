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
