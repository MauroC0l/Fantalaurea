<script lang="ts">
  import { fly } from 'svelte/transition';
  import { ALL_FEATURES_ON, type FeatureName, type Features } from '../../domain/features';
  import Button from '../../ui/components/Button.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import type { IconName } from '../../ui/icons';
  import { duration, easing, stagger } from '../../ui/theme/motion';

  interface Props {
    /** Present only on first access: the rules then end with the call to join. */
    onjoin?: () => void;
    /** What the admin switched on; before joining nobody knows yet, so everything is shown. */
    features?: Features;
  }

  let { onjoin, features = ALL_FEATURES_ON }: Props = $props();

  interface Line {
    readonly icon: IconName;
    readonly title: string;
    readonly text: string;
  }

  // Wording chosen by the user (2026-09-25).
  const RULES: readonly Line[] = [
    { icon: 'checklist', title: 'Azioni', text: 'Esegui le azioni per ottenere i relativi punti: chi ne ha di più vince!' },
    { icon: 'camera', title: 'Prove', text: 'Alcune azioni richiedono una prova fotografica per essere completate.' },
    { icon: 'crown', title: 'Per tutti', text: 'Il bonus comune, segnato da uno, vale per ogni giocatore.' },
  ];

  /** Not rules: things you can do, shown only when switched on. */
  const POSSIBILITIES: readonly (Line & { readonly feature: FeatureName | null })[] = [
    { feature: 'challenges', icon: 'clock', title: 'Sfide a tempo', text: 'Bonus che durano pochi minuti' },
    { feature: 'feed', icon: 'home', title: 'Bacheca', text: 'Post, foto e imprese di tutti' },
    { feature: 'chat', icon: 'chat', title: 'Chat', text: 'Messaggi, foto e vocali' },
    { feature: 'polls', icon: 'poll', title: 'Sondaggi', text: 'Vota e guarda come va' },
    { feature: 'leaderboard', icon: 'trophy', title: 'Classifica', text: 'Chi è in testa' },
    { feature: null, icon: 'user', title: 'Profilo', text: 'Foto, bio e le tue imprese' },
  ];

  const possibilities = $derived(POSSIBILITIES.filter((p) => p.feature === null || features[p.feature]));
</script>

{#snippet joinFooter()}
  <Button block onclick={onjoin}>
    Partecipa <Icon name="arrowRight" size={20} />
  </Button>
{/snippet}

<Screen withTabBar={!onjoin} footer={onjoin ? joinFooter : undefined}>
  <section class="hero" in:fly={{ y: 24, duration: duration('slow'), easing }}>
    <p class="eyebrow">{onjoin ? 'Benvenuto alla' : 'Le regole della'}</p>
    <h1>Fanta<br />laurea</h1>
  </section>

  <section class="block">
    <h2>Le regole</h2>
    <ol class="rules">
      {#each RULES as rule, index (rule.title)}
        <li in:fly={{ y: 24, duration: duration('slow'), delay: stagger(index + 1, 70), easing }}>
          <span class="rule-icon"><Icon name={rule.icon} size={20} /></span>
          <p><strong>{rule.title}.</strong> {rule.text}</p>
        </li>
      {/each}
    </ol>
  </section>

  <section class="block">
    <h2>Possibilità</h2>
    <ul class="possibilities">
      {#each possibilities as possibility, index (possibility.title)}
        <li in:fly={{ y: 24, duration: duration('slow'), delay: stagger(index + RULES.length + 1, 50), easing }}>
          <Surface>
            <span class="tile">
              <span class="tile-icon"><Icon name={possibility.icon} size={22} /></span>
              <span class="tile-title">{possibility.title}</span>
              <span class="tile-text">{possibility.text}</span>
            </span>
          </Surface>
        </li>
      {/each}
    </ul>
  </section>
</Screen>

<style>
  .hero {
    display: grid;
    gap: var(--space-2);
    padding-top: var(--space-6);
  }

  .eyebrow {
    color: var(--color-text-muted);
    font-weight: var(--weight-bold);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: var(--weight-black);
    line-height: 0.95;
    text-transform: uppercase;
    background: var(--gradient-party);
    background-size: 200% 100%;
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    animation: glow 5s ease-in-out infinite alternate;
  }

  .block {
    display: grid;
    gap: var(--space-3);
  }

  h2 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: var(--weight-black);
  }

  .rules {
    display: grid;
    gap: var(--space-3);
    list-style: none;
  }

  .rules li {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .rule-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    background: var(--color-surface-strong);
    border: 1px solid var(--color-border);
    color: var(--color-accent-3);
  }

  .rules p {
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  strong {
    color: var(--color-text);
    font-weight: var(--weight-black);
  }

  /* Possibilities are tiles, not a numbered list: they are options, not duties. */
  .possibilities {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
    list-style: none;
  }

  .tile {
    display: grid;
    gap: var(--space-1);
  }

  .tile-icon {
    color: var(--color-accent-1);
  }

  .tile-title {
    font-weight: var(--weight-black);
  }

  .tile-text {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-tight);
  }

  @keyframes glow {
    to {
      background-position: 100% 50%;
    }
  }
</style>
