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

  const RULES: readonly Line[] = [
    { icon: 'key', title: 'Entra', text: 'Serve la parola della serata. Nickname a piacere, nome vero per farti riconoscere.' },
    { icon: 'checklist', title: 'Fai le azioni', text: 'Ognuna vale una volta. Sbagliato? La annulli dalle Fatte.' },
    { icon: 'flame', title: 'Punti', text: 'I bonus li danno, i malus li tolgono. Le fiamme dicono quanto è difficile.' },
    { icon: 'camera', title: 'Prove', text: 'Alcune azioni vogliono una foto.' },
    { icon: 'crown', title: 'Per tutti', text: 'Il bonus comune, segnato da uno, vale per ogni giocatore.' },
    { icon: 'alert', title: 'Fiducia', text: 'I malus li segni tu. Niente furbate.' },
  ];

  const EXTRAS: readonly (Line & { readonly feature: FeatureName | null })[] = [
    { feature: 'feed', icon: 'home', title: 'Bacheca', text: 'Foto e imprese di tutti, con i like.' },
    { feature: 'chat', icon: 'chat', title: 'Chat', text: 'Messaggi privati, foto e vocali.' },
    { feature: 'leaderboard', icon: 'trophy', title: 'Classifica', text: 'Chi è in testa, e i profili degli altri.' },
    { feature: null, icon: 'user', title: 'Profilo', text: 'La tua foto, la bio e le tue foto della serata.' },
  ];

  const extras = $derived(EXTRAS.filter((extra) => extra.feature === null || features[extra.feature]));
</script>

{#snippet joinFooter()}
  <Button block onclick={onjoin}>
    Partecipa <Icon name="arrowRight" size={20} />
  </Button>
{/snippet}

{#snippet lines(items: readonly Line[], offset: number)}
  <ol class="lines">
    {#each items as line, index (line.title)}
      <li in:fly={{ y: 24, duration: duration('slow'), delay: stagger(index + offset, 70), easing }}>
        <span class="line-icon"><Icon name={line.icon} size={20} /></span>
        <p><strong>{line.title}.</strong> {line.text}</p>
      </li>
    {/each}
  </ol>
{/snippet}

<Screen withTabBar={!onjoin} footer={onjoin ? joinFooter : undefined}>
  <section class="hero" in:fly={{ y: 24, duration: duration('slow'), easing }}>
    <p class="eyebrow">{onjoin ? 'Benvenuto alla' : 'Le regole della'}</p>
    <h1>Fanta<br />laurea</h1>
  </section>

  <div in:fly={{ y: 24, duration: duration('slow'), delay: stagger(1, 70), easing }}>
    <Surface tone="common" highlighted>
      <p class="goal-label">L’obiettivo</p>
      <p class="goal">Fare più punti di tutti.</p>
    </Surface>
  </div>

  <section class="block">
    <h2>Le regole</h2>
    {@render lines(RULES, 2)}
  </section>

  <section class="block">
    <h2>Anche nell’app</h2>
    {@render lines(extras, RULES.length + 2)}
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

  .goal-label {
    color: var(--color-common);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .goal {
    margin-top: var(--space-1);
    font-family: var(--font-display);
    font-size: var(--text-lg);
    line-height: var(--leading-tight);
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

  .lines {
    display: grid;
    gap: var(--space-3);
    list-style: none;
  }

  li {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .line-icon {
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

  li p {
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  strong {
    color: var(--color-text);
    font-weight: var(--weight-black);
  }

  @keyframes glow {
    to {
      background-position: 100% 50%;
    }
  }
</style>
