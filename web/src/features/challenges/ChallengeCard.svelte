<script lang="ts">
  import { canComplete, earnedPoints, isRunning, secondsLeft, spotsLeft, type Challenge } from '../../domain/challenge';
  import AvatarStack from '../../ui/components/AvatarStack.svelte';
  import Badge from '../../ui/components/Badge.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import PointsPill from '../../ui/components/PointsPill.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import { formatTimeLeft } from '../labels';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';

  interface Props {
    challenge: Challenge;
    now: Date;
    /** false for the admin, who does not take part. */
    canTakePart: boolean;
    busy: boolean;
    links: PhotoLinksCache;
    oncomplete: () => void;
    onundo: () => void;
    onmanage: () => void;
    oncompleters: () => void;
  }

  let { challenge, now, canTakePart, busy, links, oncomplete, onundo, onmanage, oncompleters }: Props = $props();

  const running = $derived(isRunning(challenge, now));
  const spots = $derived(spotsLeft(challenge));
  const who = $derived(
    challenge.winnersLimit === null
      ? 'Punti a tutti quelli che la fanno in tempo'
      : `Punti solo ${challenge.winnersLimit === 1 ? 'al primo' : `ai primi ${challenge.winnersLimit}`}${running && spots !== null ? ` · ${spots === 1 ? 'resta 1 posto' : `restano ${spots} posti`}` : ''}`,
  );
</script>

<Surface tone="bonus" highlighted={running && canTakePart && canComplete(challenge, now)}>
  <article class="challenge">
    <header class="head">
      {#if running}
        <Badge tone="common"><Icon name="clock" size={12} /> {formatTimeLeft(secondsLeft(challenge, now))}</Badge>
      {:else}
        <Badge tone="neutral">Finita</Badge>
      {/if}
      <span class="by">{challenge.creator?.nickname ?? 'Admin'}</span>
      <PointsPill points={challenge.points} />
      {#if challenge.canManage}
        <IconButton icon="more" label="Gestisci la sfida" onclick={onmanage} />
      {/if}
    </header>

    <h3 class="title">{challenge.title}</h3>
    {#if challenge.description}<p class="description">{challenge.description}</p>{/if}
    <p class="who">{who}</p>

    {#if challenge.winners.length > 0}
      <button class="winners" onclick={oncompleters}>
        <AvatarStack
          label="Chi l’ha fatta"
          people={challenge.winners.map((w) => ({ id: w.id, nickname: w.nickname, src: links.get(w.avatarId)?.thumbnailUrl }))}
        />
        <span class="count">{challenge.completions === 1 ? '1 l’ha fatta' : `${challenge.completions} l’hanno fatta`}</span>
        <Icon name="chevronRight" size={16} />
      </button>
    {/if}

    {#if canTakePart}
      {#if challenge.mine}
        <div class="done">
          <span class="done-text">
            <Icon name="check" size={16} />
            {earnedPoints(challenge) ? `Fatta! Sei ${challenge.mine.rank}°` : 'Fatta, ma fuori dai primi: niente punti'}
          </span>
          {#if running}<Button size="small" variant="ghost" loading={busy} onclick={onundo}>Annulla</Button>{/if}
        </div>
      {:else if canComplete(challenge, now)}
        <Button block loading={busy} onclick={oncomplete}><Icon name="check" size={20} /> Fatta!</Button>
      {:else if running}
        <p class="closed">I posti sono finiti.</p>
      {/if}
    {/if}
  </article>
</Surface>

<style>
  .challenge {
    display: grid;
    gap: var(--space-2);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .by {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
  }

  .title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    line-height: var(--leading-tight);
    overflow-wrap: anywhere;
  }

  .description {
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  .who {
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .winners {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text-muted);
    text-align: left;
  }

  .count {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .done {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .done-text {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-bonus);
    font-weight: var(--weight-black);
  }

  .closed {
    color: var(--color-text-muted);
    font-weight: var(--weight-bold);
  }
</style>
