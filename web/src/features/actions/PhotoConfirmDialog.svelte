<script lang="ts">
  import type { Action } from '../../domain/action';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import PhotoPickerButton from '../../ui/components/PhotoPickerButton.svelte';

  interface Props {
    action: Action | null;
    file: File | null;
    sending: boolean;
    onsend: () => void;
    onrepick: (file: File) => void;
    onclose: () => void;
  }

  let { action, file, sending, onsend, onrepick, onclose }: Props = $props();

  const preview = $derived(file ? URL.createObjectURL(file) : null);

  $effect(() => {
    const url = preview;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });
</script>

{#snippet actions()}
  <Button block loading={sending} onclick={onsend}><Icon name="check" size={20} /> Invia e completa</Button>
  <PhotoPickerButton block variant="ghost" disabled={sending} onpick={onrepick}>
    <Icon name="camera" size={20} /> Scegli un'altra foto
  </PhotoPickerButton>
{/snippet}

<Dialog open={!!action && !!file} title={action?.title ?? ''} onclose={() => !sending && onclose()} {actions}>
  {#if preview}
    <img class="preview" src={preview} alt="Anteprima della foto" />
  {/if}
  <p>La vedrete solo tu e l'admin. Viene inviata in alta qualità.</p>
</Dialog>

<style>
  .preview {
    width: 100%;
    max-height: 45dvh;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
</style>
