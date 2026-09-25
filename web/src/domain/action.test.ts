import { describe, expect, it } from 'vitest';
import { validateActionDraft, type ActionDraft } from './action';

const draft = (overrides: Partial<ActionDraft>): ActionDraft => ({
  title: 'Titolo',
  description: 'Descrizione',
  kind: 'bonus',
  photoPolicy: 'none',
  difficulty: 'medium',
  points: 10,
  ...overrides,
});

describe('validateActionDraft', () => {
  it('normalizes spacing and keeps kind and photo policy', () => {
    expect(validateActionDraft(draft({ title: '  Balla  ', description: ' sul   tavolo ', photoPolicy: 'required' }))).toEqual({
      ok: true,
      value: { title: 'Balla', description: 'sul tavolo', kind: 'bonus', photoPolicy: 'required', difficulty: 'medium', points: 10 },
    });
  });

  it('reports every invalid text field', () => {
    expect(validateActionDraft(draft({ title: 'x', description: 'y'.repeat(301), points: -5 }))).toEqual({
      ok: false,
      error: [
        { field: 'title', reason: 'too-short' },
        { field: 'description', reason: 'too-long' },
        { field: 'points', reason: 'out-of-range' },
      ],
    });
  });

  it('accepts only whole points between 0 and 1000', () => {
    expect(validateActionDraft(draft({ points: 1000 })).ok).toBe(true);
    expect(validateActionDraft(draft({ points: 1001 })).ok).toBe(false);
    expect(validateActionDraft(draft({ points: 2.5 })).ok).toBe(false);
  });
});
