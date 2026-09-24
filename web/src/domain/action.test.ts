import { describe, expect, it } from 'vitest';
import { validateActionDraft } from './action';

describe('validateActionDraft', () => {
  it('normalizes spacing and keeps the kind', () => {
    expect(validateActionDraft({ label: '  Balla   sul tavolo ', kind: 'malus' })).toEqual({
      ok: true,
      value: { label: 'Balla sul tavolo', kind: 'malus' },
    });
  });

  it('rejects labels that are too short or too long', () => {
    expect(validateActionDraft({ label: ' ab ', kind: 'bonus' })).toEqual({ ok: false, error: 'too-short' });
    expect(validateActionDraft({ label: 'x'.repeat(201), kind: 'bonus' })).toEqual({ ok: false, error: 'too-long' });
  });
});
