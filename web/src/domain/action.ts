export type ActionKind = 'bonus' | 'malus' | 'common';

export interface Action {
  readonly id: string;
  readonly label: string;
  readonly points: number;
  readonly kind: ActionKind;
}

export function isSharedByEveryone(action: Action): boolean {
  return action.kind === 'common';
}
