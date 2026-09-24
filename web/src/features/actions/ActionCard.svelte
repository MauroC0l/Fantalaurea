<script lang="ts">
  import type { Action } from '../../domain/action';
  import type { Step } from '../../domain/counts';
  import Badge from '../../ui/components/Badge.svelte';
  import Stepper from '../../ui/components/Stepper.svelte';
  import Surface from '../../ui/components/Surface.svelte';

  interface Props {
    action: Action;
    count: number;
    onstep: (step: Step) => void;
  }

  let { action, count, onstep }: Props = $props();

  const BADGE_LABELS = { bonus: 'Bonus', malus: 'Malus', common: 'Vale per tutti' } as const;
</script>

<Surface tone={action.kind} highlighted={count > 0 || action.kind === 'common'}>
  <div class="card">
    <Badge tone={action.kind}>{BADGE_LABELS[action.kind]}</Badge>
    <p class="label">{action.label}</p>
    <div class="stepper">
      <Stepper value={count} tone={action.kind} label={action.label} {onstep} />
    </div>
  </div>
</Surface>

<style>
  .card {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }

  .label {
    font-weight: var(--weight-bold);
    line-height: var(--leading-normal);
  }

  .stepper {
    justify-self: end;
  }
</style>
