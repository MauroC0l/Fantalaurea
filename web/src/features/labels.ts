import type { ActionKind, PhotoPolicy } from '../domain/action';

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

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
