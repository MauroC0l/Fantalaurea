<script lang="ts">
  import { BIO_MAX } from '../../domain/profile';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import TextField from '../../ui/components/TextField.svelte';

  interface Props {
    /** null = closed. */
    initial: string | null;
    saving: boolean;
    onsave: (bio: string) => void;
    onclose: () => void;
  }

  let { initial, saving, onsave, onclose }: Props = $props();

  let bio = $state('');

  $effect(() => {
    if (initial !== null) bio = initial;
  });
</script>

{#snippet actions()}
  <Button block loading={saving} onclick={() => onsave(bio)}>Salva</Button>
  <Button block variant="ghost" onclick={onclose}>Annulla</Button>
{/snippet}

<Dialog open={initial !== null} title="La tua bio" onclose={() => !saving && onclose()} {actions}>
  <TextField
    name="bio"
    label="Raccontati"
    hint="Facoltà, superpoteri, cocktail preferito…"
    multiline
    counter
    maxlength={BIO_MAX}
    bind:value={bio}
  />
</Dialog>
