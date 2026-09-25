<script lang="ts">
  import { fly } from 'svelte/transition';
  import Button from '../../ui/components/Button.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import type { IconName } from '../../ui/icons';
  import { duration, easing, stagger } from '../../ui/theme/motion';

  interface Props {
    /** Present only on first access: the rules then end with the call to join. */
    onjoin?: () => void;
  }

  let { onjoin }: Props = $props();

  const STEPS: readonly { icon: IconName; title: string; text: string }[] = [
    { icon: 'key', title: 'Parola della serata', text: 'La festa è a porte chiuse: per entrare serve la parola segreta che ti dà chi organizza.' },
    { icon: 'party', title: 'Iscriviti', text: 'Scegli un nickname divertente e scrivi il tuo nome vero, così tutti ti riconoscono.' },
    { icon: 'checklist', title: 'Completa le azioni', text: 'Tocca un’azione per leggerla e segnala come fatta. Ogni azione vale una volta sola: finisce tra le Fatte.' },
    { icon: 'camera', title: 'Alcune vogliono una foto', text: 'Per certe azioni serve una prova: la foto finisce in bacheca, visibile a tutti i partecipanti.' },
    { icon: 'home', title: 'La bacheca', text: 'Qui compaiono le imprese di tutti e i post con le foto della serata. Metti like e scopri chi li ha messi.' },
    { icon: 'user', title: 'Il tuo profilo', text: 'Aggiungi una foto e una bio, e guarda i profili degli altri dalla classifica.' },
    { icon: 'alert', title: 'Anche i malus', text: 'I malus li segni tu. Il gioco si basa sulla fiducia: niente furbate.' },
    { icon: 'crown', title: 'Il bonus comune', text: 'Vale per tutti: chi lo segna lo fa comparire come fatto per ogni giocatore.' },
    { icon: 'undo', title: 'Hai sbagliato?', text: 'Dalle Fatte puoi annullare un’azione: torna tra quelle da fare.' },
    { icon: 'flame', title: 'Punti e difficoltà', text: 'Ogni azione vale dei punti (i malus li tolgono) e ha 1-3 fiamme di difficoltà: filtra quelle alla tua portata.' },
    { icon: 'users', title: 'La classifica', text: 'Nella sezione Partecipanti vedi chi è in testa: vince chi fa più punti.' },
  ];
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

  <div in:fly={{ y: 24, duration: duration('slow'), delay: stagger(1, 90), easing }}>
    <Surface tone="common" highlighted>
      <p class="goal-label">L’obiettivo</p>
      <p class="goal">Completare le azioni. Semplice: più ne fai, più ti diverti.</p>
    </Surface>
  </div>

  <ol class="steps">
    {#each STEPS as step, index (step.title)}
      <li in:fly={{ y: 24, duration: duration('slow'), delay: stagger(index + 2, 90), easing }}>
        <span class="step-icon"><Icon name={step.icon} /></span>
        <div>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
        </div>
      </li>
    {/each}
  </ol>
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

  .steps {
    display: grid;
    gap: var(--space-5);
    list-style: none;
  }

  li {
    display: flex;
    gap: var(--space-4);
    align-items: flex-start;
  }

  .step-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    background: var(--color-surface-strong);
    border: 1px solid var(--color-border);
    color: var(--color-accent-3);
  }

  h2 {
    font-size: var(--text-md);
    font-weight: var(--weight-black);
  }

  li p {
    color: var(--color-text-muted);
  }

  @keyframes glow {
    to {
      background-position: 100% 50%;
    }
  }
</style>
