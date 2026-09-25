<script lang="ts">
  import { fly } from 'svelte/transition';
  import { joinGame, type JoinError } from '../../application/join-game';
  import type { PlayerAccounts, SessionStore } from '../../application/ports';
  import type { RealNameResolution } from '../../domain/evening';
  import { IDENTITY_LIMITS, type IdentityError, type IdentityField, type Session } from '../../domain/player';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import TextField from '../../ui/components/TextField.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';

  interface Props {
    accounts: PlayerAccounts;
    sessions: SessionStore;
    /** Empty on the admin's way in: the admin enters without it. */
    secretWord: string;
    onjoined: (session: Session) => void;
    /** The word changed meanwhile: ask for it again. */
    onwrongword: () => void;
  }

  let { accounts, sessions, secretWord, onjoined, onwrongword }: Props = $props();

  let nickname = $state('');
  let realName = $state('');
  let submitting = $state(false);
  let errors = $state<Partial<Record<IdentityField, string>>>({});
  let existing = $state<{ id: string; nickname: string } | null>(null);

  function describe(error: IdentityError): string {
    const { min, max } = IDENTITY_LIMITS[error.field];
    return error.reason === 'too-short' ? `Almeno ${min} caratteri` : `Massimo ${max} caratteri`;
  }

  function show(error: JoinError): void {
    switch (error.kind) {
      case 'invalid':
        errors = Object.fromEntries(error.errors.map((e) => [e.field, describe(e)]));
        return;
      case 'nickname-taken':
        errors = { nickname: 'Nickname già preso. Se sei tu, controlla il nome vero.' };
        return;
      case 'real-name-exists':
        existing = error.existing;
        return;
      case 'wrong-word':
        toasts.show(secretWord ? 'La parola della serata è cambiata: chiedi quella nuova' : 'Qui serve la parola della serata', 'error');
        onwrongword();
        return;
      case 'rejected':
        toasts.show('Non è stato possibile: riprova', 'error');
        return;
      case 'unavailable':
        toasts.show('Connessione assente: riprova tra un attimo', 'error');
    }
  }

  async function join(resolution: RealNameResolution) {
    if (submitting) return;
    submitting = true;
    errors = {};
    const result = await joinGame({ accounts, sessions }, { secretWord, identity: { nickname, realName }, resolution });
    submitting = false;
    if (result.ok) {
      existing = null;
      onjoined(result.value);
    } else {
      show(result.error);
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    void join({ kind: 'ask' });
  }
</script>

<Screen>
  <ScreenHeader eyebrow="Iscrizione" title="Chi sei stasera?">
    <p>Nickname per divertirsi, nome vero per farsi riconoscere.</p>
  </ScreenHeader>

  <form class="form" onsubmit={submit} novalidate in:fly={{ y: 24, duration: duration('slow'), delay: stagger(1, 120), easing }}>
    <TextField
      name="nickname"
      label="Nickname"
      hint="Più è assurdo, meglio è"
      maxlength={IDENTITY_LIMITS.nickname.max}
      error={errors.nickname}
      bind:value={nickname}
    />
    <TextField
      name="realName"
      label="Nome vero"
      hint="Nome e cognome, così ti riconoscono"
      maxlength={IDENTITY_LIMITS.realName.max}
      autocomplete="name"
      autocapitalize="words"
      error={errors.realName}
      bind:value={realName}
    />
    <Button type="submit" block loading={submitting}>
      Entra nella festa <Icon name="arrowRight" size={20} />
    </Button>
    <p class="recover">
      Già iscritto su un altro telefono? Inserisci lo stesso nickname e lo stesso nome: ritrovi le tue azioni.
    </p>
  </form>
</Screen>

{#snippet takeoverActions()}
  {#if existing}
    {@const playerId = existing.id}
    <Button block loading={submitting} onclick={() => join({ kind: 'takeover', playerId })}>Sì, sono io</Button>
  {/if}
  <Button block variant="ghost" disabled={submitting} onclick={() => join({ kind: 'distinct' })}>No, sono un'altra persona</Button>
  <Button block variant="ghost" disabled={submitting} onclick={() => (existing = null)}>Annulla</Button>
{/snippet}

<Dialog open={existing !== null} title="Nome già registrato" onclose={() => !submitting && (existing = null)} actions={takeoverActions}>
  {#if existing}
    <p>
      Esiste già il profilo <strong>{existing.nickname}</strong> con il nome <strong>{realName}</strong>. Sei tu?
    </p>
    <p>Se sì, il vecchio profilo diventa <strong>{nickname}</strong> e tieni azioni, foto e punti.</p>
  {/if}
</Dialog>

<style>
  .form {
    display: grid;
    gap: var(--space-5);
  }

  .recover {
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
    text-align: center;
  }
</style>
