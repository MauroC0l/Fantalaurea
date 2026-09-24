<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import AnimatedNumber from '../../ui/components/AnimatedNumber.svelte';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Badge from '../../ui/components/Badge.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';
  import type { GameState } from '../game/game-state.svelte';

  let { game }: { game: GameState } = $props();

  const count = $derived(game.participants.length);
  const others = $derived(game.participants.filter((p) => p.player.id !== game.session.player.id));
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Partecipanti" title="Chi gioca stasera">
    <p>{count === 1 ? '1 persona in gioco' : `${count} persone in gioco`}</p>
  </ScreenHeader>

  {#if game.status === 'loading'}
    <Loader label="Cerco i partecipanti…" />
  {:else}
    <ul class="list">
      {#each game.participants as participant, index (participant.player.id)}
        {@const isMe = participant.player.id === game.session.player.id}
        <li
          animate:flip={{ duration: duration('slow'), easing }}
          in:fly={{ y: 20, duration: duration('base'), delay: stagger(index), easing }}
        >
          <Surface highlighted={isMe}>
            <div class="row">
              <span class="rank">{index + 1}</span>
              <Avatar name={participant.player.nickname} />
              <div class="names">
                <p class="nickname">
                  {participant.player.nickname}
                  {#if isMe}<Badge tone="neutral">Tu</Badge>{/if}
                </p>
                <p class="real-name">{participant.player.realName}</p>
              </div>
              <p class="done">
                <span class="done-number"><AnimatedNumber value={participant.actionsDone} /></span>
                <span class="done-label">azioni</span>
              </p>
            </div>
          </Surface>
        </li>
      {/each}
    </ul>
    {#if others.length === 0}
      <EmptyState icon="party" title="Sei il primo!">
        <p>Condividi il link: appena qualcuno si iscrive, compare qui.</p>
      </EmptyState>
    {/if}
  {/if}
</Screen>

<style>
  .list {
    display: grid;
    gap: var(--space-3);
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .rank {
    min-width: 2ch;
    color: var(--color-text-subtle);
    font-family: var(--font-display);
    font-weight: var(--weight-black);
    text-align: center;
  }

  .names {
    flex: 1;
    min-width: 0;
  }

  .nickname {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: var(--weight-black);
    overflow-wrap: anywhere;
  }

  .real-name {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .done {
    display: grid;
    justify-items: end;
    line-height: 1;
  }

  .done-number {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: var(--weight-black);
    background: var(--gradient-party);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }

  .done-label {
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
