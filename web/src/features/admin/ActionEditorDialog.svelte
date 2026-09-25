<script lang="ts">
  import type { ActionTarget, SaveActionError } from '../../application/save-action';
  import {
    ACTION_TEXT_LIMITS,
    MAX_POINTS,
    pointsMagnitude,
    type Action,
    type ActionDraft,
    type ActionKind,
    type ActionTextField,
    type Difficulty,
    type PhotoPolicy,
  } from '../../domain/action';
  import type { Result } from '../../domain/result';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import SegmentedControl from '../../ui/components/SegmentedControl.svelte';
  import TextField from '../../ui/components/TextField.svelte';
  import { DIFFICULTY_LABELS, KIND_LABELS, PHOTO_POLICY_LABELS } from '../labels';

  interface Props {
    /** null = closed; 'new' = create; an action = edit it. */
    editing: Action | 'new' | null;
    onsave: (target: ActionTarget, draft: ActionDraft) => Promise<Result<void, SaveActionError>>;
    onfailure: (error: SaveActionError) => void;
    onclose: () => void;
  }

  let { editing, onsave, onfailure, onclose }: Props = $props();

  const KINDS = (Object.keys(KIND_LABELS) as ActionKind[]).map((value) => ({ value, label: KIND_LABELS[value] }));
  const POLICIES = (Object.keys(PHOTO_POLICY_LABELS) as PhotoPolicy[]).map((value) => ({
    value,
    label: PHOTO_POLICY_LABELS[value],
  }));

  const DIFFICULTIES = (Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((value) => ({
    value,
    label: DIFFICULTY_LABELS[value],
  }));

  let title = $state('');
  let description = $state('');
  let kind = $state<ActionKind>('bonus');
  let photoPolicy = $state<PhotoPolicy>('none');
  let difficulty = $state<Difficulty>('medium');
  let points = $state('');
  let errors = $state<Partial<Record<ActionTextField | 'kind' | 'points', string>>>({});
  let saving = $state(false);

  $effect(() => {
    const source = editing === 'new' ? null : editing;
    title = source?.title ?? '';
    description = source?.description ?? '';
    kind = source?.kind ?? 'bonus';
    photoPolicy = source?.photoPolicy ?? 'none';
    difficulty = source?.difficulty ?? 'medium';
    points = source ? String(pointsMagnitude(source)) : '10';
    errors = {};
  });

  function describe(error: SaveActionError): typeof errors | null {
    if (error.kind === 'kind-locked') {
      return { kind: 'Qualcuno l’ha già completata: non puoi spostarla da o verso "Per tutti".' };
    }
    if (error.kind !== 'invalid') return null;
    return Object.fromEntries(
      error.errors.map((error) => {
        if (error.field === 'points') return ['points', `Un numero intero da 0 a ${MAX_POINTS}`];
        const { min, max } = ACTION_TEXT_LIMITS[error.field];
        return [error.field, error.reason === 'too-short' ? `Almeno ${min} caratteri` : `Massimo ${max} caratteri`];
      }),
    );
  }

  async function save() {
    if (saving || editing === null) return;
    saving = true;
    errors = {};
    const target: ActionTarget = editing === 'new' ? { kind: 'new' } : { kind: 'existing', id: editing.id };
    const draft = { title, description, kind, photoPolicy, difficulty, points: Number(points.trim() || NaN) };
    const result = await onsave(target, draft);
    saving = false;
    if (result.ok) return onclose();
    const fieldErrors = describe(result.error);
    if (fieldErrors) errors = fieldErrors;
    else onfailure(result.error);
  }
</script>

{#snippet actions()}
  <Button block loading={saving} onclick={save}>{editing === 'new' ? 'Aggiungi' : 'Salva'}</Button>
  <Button block variant="ghost" onclick={onclose}>Annulla</Button>
{/snippet}

<Dialog
  open={editing !== null}
  title={editing === 'new' ? 'Nuova azione' : 'Modifica azione'}
  onclose={() => !saving && onclose()}
  {actions}
>
  <TextField name="action-title" label="Titolo" maxlength={ACTION_TEXT_LIMITS.title.max} error={errors.title} bind:value={title} />
  <TextField
    name="action-description"
    label="Descrizione"
    hint="Si legge aprendo l'azione: spiegala bene"
    multiline
    maxlength={ACTION_TEXT_LIMITS.description.max}
    error={errors.description}
    bind:value={description}
  />
  <div class="field">
    <p class="label">Tipo</p>
    <SegmentedControl label="Tipo di azione" options={KINDS} bind:value={kind} />
    {#if errors.kind}<p class="error">{errors.kind}</p>{/if}
  </div>
  <TextField
    name="action-points"
    label="Punti"
    inputmode="numeric"
    maxlength={4}
    hint={kind === 'malus' ? 'Per un malus vengono tolti a chi lo segna' : kind === 'common' ? 'Li ricevono tutti i giocatori' : 'Li riceve chi completa l’azione'}
    error={errors.points}
    bind:value={points}
  />
  <div class="field">
    <p class="label">Difficoltà</p>
    <SegmentedControl label="Difficoltà dell'azione" options={DIFFICULTIES} bind:value={difficulty} />
  </div>
  <div class="field">
    <p class="label">Foto</p>
    <SegmentedControl label="Foto per completare l'azione" options={POLICIES} bind:value={photoPolicy} />
    <p class="hint">
      {#if photoPolicy === 'required'}Senza foto l'azione non si può completare.
      {:else if photoPolicy === 'optional'}Chi completa l'azione può allegare una foto.
      {:else}L'azione si completa senza foto.{/if}
    </p>
  </div>
</Dialog>

<style>
  .field {
    display: grid;
    gap: var(--space-2);
  }

  .label {
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .hint {
    padding: 0 var(--space-2);
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
  }

  .error {
    padding: 0 var(--space-2);
    color: var(--color-danger);
    font-size: var(--text-sm);
  }
</style>
