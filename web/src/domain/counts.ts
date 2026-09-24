export type ActionCounts = Readonly<Record<string, number>>;

export type Step = 1 | -1;

export function countOf(counts: ActionCounts, actionId: string): number {
  return counts[actionId] ?? 0;
}

export function withCount(counts: ActionCounts, actionId: string, count: number): ActionCounts {
  return { ...counts, [actionId]: count };
}

export function nextCount(current: number, step: Step): number {
  return Math.max(0, current + step);
}

export function isValidCount(count: number): boolean {
  return Number.isInteger(count) && count >= 0;
}

export function totalActions(counts: ActionCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}
