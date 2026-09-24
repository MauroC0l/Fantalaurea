<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Haptics } from '../../application/ports';
  import type { Action, ActionKind } from '../../domain/action';
  import type { Step } from '../../domain/counts';
  import AnimatedNumber from '../../ui/components/AnimatedNumber.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import SegmentedControl from '../../ui/components/SegmentedControl.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';
  import type { GameState } from '../game/game-state.svelte';
  import ActionCard from './ActionCard.svelte';

  interface Props {
    game: GameState;
    haptics: Haptics;
    onlogout: () => void;
  }

  let { game, haptics, onlogout }: Props = $props();

  let confirmingLogout = $state(false);

  type Filter = 'all' | 'bonus' | 'malus';

  const FILTERS: readonly { value: Filter; label: string }[] = [
    { value: 'all', label: 'Tutte' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'malus', label: 'Malus' },
  ];

  const VISIBLE_KINDS: Record<Filter, readonly ActionKind[]> = {
    all: ['common', 'bonus', 'malus'],
    bonus: ['common', 'bonus'],
    malus: ['malus'],
  };

  let filter = $state<Filter>('all');

  const visible = $derived(
    VISIBLE_KINDS[filter].flatMap((kind) => game.catalog.filter((action) => action.kind === kind)),
  );

  function step(action: Action, direction: Step) {
    haptics.pulse(action.kind === 'malus' && direction === 1 ? 'warning' : 'tap');
    game.step(action, direction);
  }
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Ciao, {game.session.player.nickname}" title="Le tue azioni">
    <p class="total">
      <span class="total-number"><AnimatedNumber value={game.totalDone} /></span>
      {game.totalDone === 1 ? 'azione fatta finora' : 'azioni fatte finora'}
    </p>
    {#snippet trailing()}
      <IconButton icon="logout" label="Esci" onclick={() => (confirmingLogout = true)} />
    {/snippet}
  </ScreenHeader>

  {#if game.status === 'loading'}
    <Loader label="Carico le azioni…" />
  {:else if game.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare le azioni">
      <p>Controlla la connessione e riprova.</p>
      <Button variant="ghost" onclick={() => game.start()}>
        <Icon name="refresh" size={20} /> Riprova
      </Button>
    </EmptyState>
  {:else}
    <SegmentedControl label="Filtra le azioni" options={FILTERS} bind:value={filter} />
    {#key filter}
      <ul class="list">
        {#each visible as action, index (action.id)}
          <li in:fly={{ y: 20, duration: duration('base'), delay: stagger(index), easing }}>
            <ActionCard {action} count={game.countOf(action)} onstep={(direction) => step(action, direction)} />
          </li>
        {/each}
      </ul>
    {/key}
  {/if}
</Screen>

{#snippet logoutActions()}
  <Button variant="danger" block onclick={onlogout}>Esci</Button>
  <Button variant="ghost" block onclick={() => (confirmingLogout = false)}>Resta</Button>
{/snippet}

<Dialog open={confirmingLogout} title="Vuoi uscire?" onclose={() => (confirmingLogout = false)} actions={logoutActions}>
  <p>
    Le tue azioni restano salvate. Per rientrare usa lo stesso nickname
    (<strong>{game.session.player.nickname}</strong>) e lo stesso nome vero.
  </p>
</Dialog>

<style>
  .total {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .total-number {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: var(--weight-black);
    color: var(--color-text);
  }

  .list {
    display: grid;
    gap: var(--space-3);
    list-style: none;
  }
</style>
