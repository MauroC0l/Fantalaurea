<script lang="ts">
  import { CAPTION_MAX } from '../../domain/feed';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import PhotoPickerButton from '../../ui/components/PhotoPickerButton.svelte';
  import TextField from '../../ui/components/TextField.svelte';

  interface Props {
    file: File | null;
    publishing: boolean;
    onpublish: (caption: string) => void;
    onrepick: (file: File) => void;
    onclose: () => void;
  }

  let { file, publishing, onpublish, onrepick, onclose }: Props = $props();

  let caption = $state('');

  const preview = $derived(file ? URL.createObjectURL(file) : null);

  $effect(() => {
    const url = preview;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  $effect(() => {
    if (!file) caption = '';
  });
</script>

{#snippet actions()}
  <Button block loading={publishing} onclick={() => onpublish(caption)}><Icon name="share" size={20} /> Pubblica</Button>
  <PhotoPickerButton block variant="ghost" disabled={publishing} onpick={onrepick}>
    <Icon name="camera" size={20} /> Scegli un'altra foto
  </PhotoPickerButton>
{/snippet}

<Dialog open={!!file} title="Nuovo post" onclose={() => !publishing && onclose()} {actions}>
  {#if preview}
    <img class="preview" src={preview} alt="Anteprima del post" />
  {/if}
  <TextField name="post-caption" label="Didascalia (facoltativa)" multiline counter maxlength={CAPTION_MAX} bind:value={caption} />
  <p>Lo vedranno tutti i partecipanti della serata.</p>
</Dialog>

<style>
  .preview {
    width: 100%;
    max-height: 38dvh;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
</style>
