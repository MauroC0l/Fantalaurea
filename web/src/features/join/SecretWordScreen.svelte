<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { PlayerAccounts } from '../../application/ports';
  import Button from '../../ui/components/Button.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import TextField from '../../ui/components/TextField.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';

  interface Props {
    accounts: PlayerAccounts;
    onaccepted: (word: string) => void;
    onadmin: () => void;
    onback: () => void;
  }

  let { accounts, onaccepted, onadmin, onback }: Props = $props();

  let word = $state('');
  let error = $state<string>();
  let checking = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (checking) return;
    error = undefined;
    if (!word.trim()) {
      error = 'Scrivi la parola della serata';
      return;
    }
    checking = true;
    const result = await accounts.checkSecretWord(word);
    checking = false;
    if (!result.ok) return toasts.show('Connessione assente: riprova tra un attimo', 'error');
    if (result.value) onaccepted(word);
    else error = 'Parola sbagliata: chiedila a chi organizza';
  }
</script>

<Screen>
  <ScreenHeader eyebrow="Accesso" title="Parola della serata" {onback}>
    <p>La festa è a porte chiuse: serve la parola segreta che ti ha dato chi organizza.</p>
  </ScreenHeader>

  <form class="form" onsubmit={submit} novalidate in:fly={{ y: 24, duration: duration('slow'), delay: stagger(1, 120), easing }}>
    <TextField
      name="secret-word"
      label="Parola segreta"
      hint="Maiuscole, spazi e trattini non contano"
      autocapitalize="none"
      {error}
      bind:value={word}
    />
    <Button type="submit" block loading={checking}>
      <Icon name="key" size={20} /> Entra
    </Button>
  </form>

  <button class="admin" onclick={onadmin}>Sei l'admin? Entra da qui</button>
</Screen>

<style>
  .form {
    display: grid;
    gap: var(--space-5);
  }

  .admin {
    justify-self: center;
    min-height: var(--tap-size);
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
