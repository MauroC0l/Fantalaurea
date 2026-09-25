import { describe, expect, it } from 'vitest';
import type { Action } from './action';
import { effectOfDeletingPhoto, isOwnedBy, type Completion } from './completion';

const action = (photoPolicy: Action['photoPolicy']): Action => ({
  id: 'a',
  title: 'T',
  description: 'D',
  points: 0,
  kind: 'bonus',
  photoPolicy,
  difficulty: 'medium',
});

describe('completion rules', () => {
  it('undoes the action only when its photo was required', () => {
    expect(effectOfDeletingPhoto(action('required'))).toEqual({ undoesAction: true });
    expect(effectOfDeletingPhoto(action('optional'))).toEqual({ undoesAction: false });
  });

  it('knows who owns a completion', () => {
    const completion: Completion = { actionId: 'a', completedAt: new Date(), hasPhoto: false, by: { id: 'p1', nickname: 'N' } };
    expect(isOwnedBy(completion, 'p1')).toBe(true);
    expect(isOwnedBy(completion, 'p2')).toBe(false);
  });
});
