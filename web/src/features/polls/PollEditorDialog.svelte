<script lang="ts">
  import {
    DEFAULT_POLL_RULES,
    POLL_DURATION_MAX,
    POLL_DURATIONS,
    POLL_OPTION_MAX,
    POLL_OPTIONS_MAX,
    POLL_OPTIONS_MIN,
    POLL_QUESTION_MAX,
    type PollDraft,
    type PollDraftError,
    type ResultsVisibility,
  } from '../../domain/poll';
  import Button from '../../ui/components/Button.svelte';
  import ChipGroup from '../../ui/components/ChipGroup.svelte';
  import DurationPicker from '../../ui/components/DurationPicker.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import Switch from '../../ui/components/Switch.svelte';
  import TextField from '../../ui/components/TextField.svelte';

  interface Props {
    open: boolean;
    saving: boolean;
    errors: readonly PollDraftError[];
    onsave: (draft: PollDraft) => void;
    onclose: () => void;
  }

  let { open, saving, errors, onsave, onclose }: Props = $props();

  let question = $state('');
  let options = $state<string[]>(['', '']);
  let rules = $state({ ...DEFAULT_POLL_RULES });
  /** A preset, "until closed" (null) or "custom" (the picker below). */
  let choice = $state<number | null | 'custom'>(null);
  let customMinutes = $state(90);
  const durationMinutes = $derived(choice === 'custom' ? customMinutes : choice);

  const RESULTS: readonly { value: ResultsVisibility; label: string }[] = [
    { value: 'always', label: 'Sempre' },
    { value: 'after-vote', label: 'Dopo il voto' },
    { value: 'after-close', label: 'A fine sondaggio' },
  ];
  const DURATIONS = [
    ...POLL_DURATIONS.map((minutes) => ({
      value: minutes as number | null | 'custom',
      label: minutes === null ? 'Finché lo chiudo' : minutes < 60 ? `${minutes} min` : `${minutes / 60} h`,
    })),
    { value: 'custom' as const, label: 'Personalizzata' },
  ];
  const MESSAGES: Record<PollDraftError, string> = {
    'question-too-short': 'Scrivi la domanda',
    'question-too-long': `Domanda troppo lunga (massimo ${POLL_QUESTION_MAX})`,
    'too-few-options': `Servono almeno ${POLL_OPTIONS_MIN} opzioni`,
    'too-many-options': `Al massimo ${POLL_OPTIONS_MAX} opzioni`,
    'option-too-long': `Opzioni di massimo ${POLL_OPTION_MAX} caratteri`,
    'duplicate-options': 'Due opzioni sono uguali',
  };

  // A fresh form every time it opens.
  $effect(() => {
    if (!open) return;
    question = '';
    options = ['', ''];
    rules = { ...DEFAULT_POLL_RULES };
    choice = null;
    customMinutes = 90;
  });

  function save() {
    onsave({ question, options, rules: { ...rules }, durationMinutes });
  }
</script>

{#snippet actions()}
  <Button block loading={saving} onclick={save}><Icon name="check" size={20} /> Pubblica il sondaggio</Button>
  <Button variant="ghost" block disabled={saving} onclick={onclose}>Annulla</Button>
{/snippet}

<Dialog {open} title="Nuovo sondaggio" {onclose} {actions}>
  <TextField name="question" label="Domanda" bind:value={question} maxlength={POLL_QUESTION_MAX} multiline />

  <div class="group">
    <p class="group-title">Opzioni</p>
    {#each options as _, index (index)}
      <div class="option">
        <TextField name="option-{index}" label="Opzione {index + 1}" bind:value={options[index]} maxlength={POLL_OPTION_MAX} />
        {#if options.length > POLL_OPTIONS_MIN}
          <IconButton icon="close" label="Togli l’opzione {index + 1}" onclick={() => (options = options.filter((__, i) => i !== index))} />
        {/if}
      </div>
    {/each}
    {#if options.length < POLL_OPTIONS_MAX}
      <Button variant="ghost" size="small" onclick={() => (options = [...options, ''])}>
        <Icon name="plus" size={16} /> Aggiungi opzione
      </Button>
    {/if}
  </div>

  <div class="group">
    <p class="group-title">Regole</p>
    <Switch checked={rules.multiple} label="Più scelte" description="Si può votare più di un’opzione" onchange={(v) => (rules.multiple = v)} />
    <Switch checked={rules.anonymous} label="Anonimo" description="Nessuno vede chi ha votato cosa" onchange={(v) => (rules.anonymous = v)} />
    <Switch checked={rules.voteChange} label="Si può cambiare voto" description="Finché il sondaggio è aperto" onchange={(v) => (rules.voteChange = v)} />
  </div>

  <div class="group">
    <p class="group-title">Risultati visibili</p>
    <ChipGroup options={RESULTS} bind:value={rules.results} label="Quando si vedono i risultati" />
  </div>

  <div class="group">
    <p class="group-title">Durata</p>
    <ChipGroup options={DURATIONS} bind:value={choice} label="Durata del sondaggio" />
    {#if choice === 'custom'}
      <DurationPicker bind:value={customMinutes} max={POLL_DURATION_MAX} label="Durata personalizzata" />
    {/if}
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

  .option {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .option > :global(:first-child) {
    flex: 1;
    min-width: 0;
  }

  .errors {
    display: grid;
    gap: var(--space-1);
    list-style: none;
    color: var(--color-danger);
    font-weight: var(--weight-bold);
  }
</style>
