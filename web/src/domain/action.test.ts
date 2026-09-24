import { describe, expect, it } from 'vitest';
import { validateActionDraft, type ActionDraft } from './action';

const draft = (overrides: Partial<ActionDraft>): ActionDraft => ({
  title: 'Titolo',
  description: 'Descrizione',
  kind: 'bonus',
  photoPolicy: 'none',
  ...overrides,
});

describe('validateActionDraft', () => {
  it('normalizes spacing and keeps kind and photo policy', () => {
    expect(validateActionDraft(draft({ title: '  Balla  ', description: ' sul   tavolo ', photoPolicy: 'required' }))).toEqual({
      ok: true,
      value: { title: 'Balla', description: 'sul tavolo', kind: 'bonus', photoPolicy: 'required' },
    });
  });

  it('reports every invalid text field', () => {
    expect(validateActionDraft(draft({ title: 'x', description: 'y'.repeat(301) }))).toEqual({
      ok: false,
      error: [
        { field: 'title', reason: 'too-short' },
        { field: 'description', reason: 'too-long' },
      ],
    });
  });
});
