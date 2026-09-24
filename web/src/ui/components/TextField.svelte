<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { duration } from '../theme/motion';

  interface Props {
    name: string;
    label: string;
    value: string;
    hint?: string;
    error?: string;
    maxlength?: number;
    autocomplete?: HTMLInputAttributes['autocomplete'];
    autocapitalize?: HTMLInputAttributes['autocapitalize'];
  }

  let {
    name,
    label,
    value = $bindable(''),
    hint,
    error,
    maxlength,
    autocomplete = 'off',
    autocapitalize = 'sentences',
  }: Props = $props();

  const id = $derived(`field-${name}`);
  const messageId = $derived(`${id}-message`);
</script>

<div class="field" class:invalid={!!error}>
  <div class="control">
    <input
      {id}
      {name}
      {maxlength}
      {autocomplete}
      {autocapitalize}
      bind:value
      placeholder=" "
      spellcheck="false"
      aria-invalid={!!error}
      aria-describedby={error || hint ? messageId : undefined}
    />
    <label for={id}>{label}</label>
  </div>
  {#if error}
    <p class="message error" id={messageId} transition:slide={{ duration: duration('fast') }}>{error}</p>
  {:else if hint}
    <p class="message" id={messageId}>{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-2);
  }

  .control {
    position: relative;
  }

  input {
    width: 100%;
    height: 64px;
    padding: var(--space-5) var(--space-4) 0;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-strong);
    background: var(--color-surface);
    font-size: var(--text-md);
    font-weight: var(--weight-bold);
    outline: none;
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));
    transition:
      border-color var(--duration-base) var(--ease-out),
      box-shadow var(--duration-base) var(--ease-out);
  }

  input:focus {
    border-color: var(--color-accent-2);
    box-shadow: var(--focus-ring);
  }

  label {
    position: absolute;
    left: var(--space-4);
    top: 50%;
    color: var(--color-text-muted);
    pointer-events: none;
    transform: translateY(-50%);
    transform-origin: left center;
    transition:
      transform var(--duration-base) var(--ease-out),
      color var(--duration-base) var(--ease-out);
  }

  input:focus + label,
  input:not(:placeholder-shown) + label {
    transform: translateY(-110%) scale(0.78);
  }

  input:focus + label {
    color: var(--color-accent-3);
  }

  .invalid input {
    border-color: var(--color-danger);
    animation: shake var(--duration-slow) var(--ease-out);
  }

  .invalid label {
    color: var(--color-danger);
  }

  .message {
    padding: 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-subtle);
  }

  .message.error {
    color: var(--color-danger);
  }

  @keyframes shake {
    15%,
    55% {
      transform: translateX(-6px);
    }
    35%,
    75% {
      transform: translateX(6px);
    }
  }
</style>
