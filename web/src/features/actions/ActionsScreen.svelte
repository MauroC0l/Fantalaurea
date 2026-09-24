<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Haptics } from '../../application/ports';
  import type { Action, ActionKind } from '../../domain/action';
  import type { Step } from '../../domain/counts';
  import AnimatedNumber from '../../ui/components/AnimatedNumber.svelte';
  import Button from '../../ui/components/Button.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import SegmentedControl from '../../ui/components/SegmentedControl.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';
  import type { GameState } from '../game/game-state.svelte';
  import ActionCard from './ActionCard.svelte';

  let { game, haptics }: { game: GameState; haptics: Haptics } = $props();

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
