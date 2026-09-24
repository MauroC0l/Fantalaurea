<script lang="ts">
  import { fly } from 'svelte/transition';
  import { joinGame, type JoinError } from '../../application/join-game';
  import type { PlayerAccounts, SessionStore } from '../../application/ports';
  import { IDENTITY_LIMITS, type IdentityError, type IdentityField, type Session } from '../../domain/player';
  import Button from '../../ui/components/Button.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import TextField from '../../ui/components/TextField.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';

  interface Props {
    accounts: PlayerAccounts;
    sessions: SessionStore;
    onjoined: (session: Session) => void;
  }

  let { accounts, sessions, onjoined }: Props = $props();

  let nickname = $state('');
  let realName = $state('');
  let submitting = $state(false);
  let errors = $state<Partial<Record<IdentityField, string>>>({});

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
      case 'unavailable':
        toasts.show('Connessione assente: riprova tra un attimo', 'error');
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    errors = {};
    const result = await joinGame({ accounts, sessions }, { nickname, realName });
    submitting = false;
    if (result.ok) onjoined(result.value);
    else show(result.error);
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
