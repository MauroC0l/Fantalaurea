<script lang="ts">
  import type { AddActionError } from '../../application/add-action';
  import { ACTION_LABEL_LIMITS, type Action, type ActionDraft, type ActionKind } from '../../domain/action';
  import type { Result } from '../../domain/result';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import SegmentedControl from '../../ui/components/SegmentedControl.svelte';
  import TextField from '../../ui/components/TextField.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
    onsubmit: (draft: ActionDraft) => Promise<Result<Action, AddActionError>>;
    onfailure: (error: AddActionError) => void;
  }

  let { open, onclose, onsubmit, onfailure }: Props = $props();

  const KINDS: readonly { value: ActionKind; label: string }[] = [
    { value: 'bonus', label: 'Bonus' },
    { value: 'malus', label: 'Malus' },
    { value: 'common', label: 'Per tutti' },
  ];

  let label = $state('');
  let kind = $state<ActionKind>('bonus');
  let error = $state<string>();
  let saving = $state(false);

  function describe(failure: AddActionError): string | undefined {
    if (failure.kind !== 'invalid') return undefined;
    return failure.reason === 'too-short'
      ? `Almeno ${ACTION_LABEL_LIMITS.min} caratteri`
      : `Massimo ${ACTION_LABEL_LIMITS.max} caratteri`;
  }

  async function submit() {
    if (saving) return;
    saving = true;
    error = undefined;
    const result = await onsubmit({ label, kind });
    saving = false;
    if (result.ok) {
      label = '';
      onclose();
      return;
    }
    error = describe(result.error);
    if (!error) onfailure(result.error);
  }
</script>

{#snippet actions()}
  <Button block loading={saving} onclick={submit}>Aggiungi</Button>
  <Button block variant="ghost" onclick={onclose}>Annulla</Button>
{/snippet}

<Dialog {open} {onclose} title="Nuova azione" {actions}>
  <SegmentedControl label="Tipo di azione" options={KINDS} bind:value={kind} />
  <TextField
    name="action-label"
    label="Descrizione"
    multiline
    maxlength={ACTION_LABEL_LIMITS.max}
    {error}
    bind:value={label}
  />
</Dialog>
