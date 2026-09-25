<script lang="ts" module>
  export interface ChallengeForm {
    title: string;
    description: string;
    points: number;
    winnersLimit: number | null;
    /** New: how long it lasts. Editing: null keeps the end, a number restarts the clock from now. */
    minutes: number | null;
  }
</script>

<script lang="ts">
  import {
    CHALLENGE_DESCRIPTION_MAX,
    CHALLENGE_DURATIONS,
    CHALLENGE_POINTS_MAX,
    CHALLENGE_TITLE_MAX,
    CHALLENGE_WINNERS,
    type Challenge,
    type ChallengeDraftError,
  } from '../../domain/challenge';
  import Button from '../../ui/components/Button.svelte';
  import ChipGroup from '../../ui/components/ChipGroup.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import TextField from '../../ui/components/TextField.svelte';

  interface Props {
    /** null = closed; 'new' = create; a challenge = edit it. */
    target: Challenge | 'new' | null;
    saving: boolean;
    errors: readonly ChallengeDraftError[];
    onsave: (form: ChallengeForm) => void;
    onclose: () => void;
  }

  let { target, saving, errors, onsave, onclose }: Props = $props();

  const POINTS = [5, 10, 20, 30, 50];

  let title = $state('');
  let description = $state('');
  let points = $state(20);
  let winnersLimit = $state<number | null>(null);
  let minutes = $state<number | null>(15);

  const editing = $derived(target !== null && target !== 'new');
  const durations = $derived([
    ...(editing ? [{ value: null, label: 'Non cambiare' }] : []),
    ...CHALLENGE_DURATIONS.map((m) => ({ value: m as number | null, label: m < 60 ? `${m} min` : `${m / 60} h` })),
  ]);
  const MESSAGES: Record<ChallengeDraftError, string> = {
    'title-too-short': 'Scrivi un titolo',
    'title-too-long': `Titolo di massimo ${CHALLENGE_TITLE_MAX} caratteri`,
    'description-too-long': `Descrizione di massimo ${CHALLENGE_DESCRIPTION_MAX} caratteri`,
    'points-out-of-range': `Punti tra 1 e ${CHALLENGE_POINTS_MAX}`,
  };

  // Filled from the challenge when editing, fresh when creating.
  $effect(() => {
    if (target === null) return;
    const source = target === 'new' ? null : target;
    title = source?.title ?? '';
    description = source?.description ?? '';
    points = source?.points ?? 20;
    winnersLimit = source?.winnersLimit ?? null;
    minutes = source ? null : 15;
  });
</script>

{#snippet actions()}
  <Button block loading={saving} onclick={() => onsave({ title, description, points, winnersLimit, minutes })}>
    <Icon name="check" size={20} /> {editing ? 'Salva le modifiche' : 'Lancia la sfida'}
  </Button>
  <Button variant="ghost" block disabled={saving} onclick={onclose}>Annulla</Button>
{/snippet}

<Dialog open={target !== null} title={editing ? 'Modifica la sfida' : 'Nuova sfida a tempo'} {onclose} {actions}>
  <TextField name="challenge-title" label="Titolo" bind:value={title} maxlength={CHALLENGE_TITLE_MAX} counter />
  <TextField
    name="challenge-description"
    label="Cosa bisogna fare (facoltativo)"
    bind:value={description}
    maxlength={CHALLENGE_DESCRIPTION_MAX}
    multiline
  />

  <div class="group">
    <p class="group-title">Punti</p>
    <ChipGroup options={POINTS.map((p) => ({ value: p, label: `+${p}` }))} bind:value={points} label="Punti della sfida" />
  </div>

  <div class="group">
    <p class="group-title">Chi prende i punti</p>
    <ChipGroup
      options={CHALLENGE_WINNERS.map((n) => ({ value: n, label: n === null ? 'Tutti in tempo' : n === 1 ? 'Solo il primo' : `I primi ${n}` }))}
      bind:value={winnersLimit}
      label="Chi prende i punti"
    />
  </div>

  <div class="group">
    <p class="group-title">{editing ? 'Tempo' : 'Durata'}</p>
    <ChipGroup options={durations} bind:value={minutes} label="Durata della sfida" />
    {#if editing && minutes !== null}<p class="hint">Riparte da adesso: {minutes} minuti.</p>{/if}
  </div>

  {#if errors.length > 0}
    <ul class="errors" role="alert">
      {#each errors as error (error)}<li>{MESSAGES[error]}</li>{/each}
    </ul>
  {/if}
</Dialog>

<style>
  .group {
    display: grid;
    gap: var(--space-3);
  }

  .group-title {
    color: var(--color-text);
    font-family: var(--font-display);
    font-weight: var(--weight-bold);
  }

  .hint {
    font-size: var(--text-sm);
  }

  .errors {
    display: grid;
    gap: var(--space-1);
    list-style: none;
    color: var(--color-danger);
    font-weight: var(--weight-bold);
  }
</style>
