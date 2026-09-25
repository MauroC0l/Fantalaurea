<script lang="ts">
  interface Props {
    value: string;
    placeholder: string;
    maxlength: number;
    onsubmit: () => void;
    /** Every keystroke, e.g. to say "sta scrivendo…". */
    oninput?: () => void;
  }

  let { value = $bindable(''), placeholder, maxlength, onsubmit, oninput }: Props = $props();

  export function focus() {
    field?.focus();
  }

  let field = $state<HTMLTextAreaElement>();

  // Grows with the text up to a few lines, then scrolls.
  $effect(() => {
    void value;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 140)}px`;
  });

  function keydown(event: KeyboardEvent) {
    // Enter sends on a computer; on a phone the keyboard's own return adds a new line.
    if (event.key === 'Enter' && !event.shiftKey && matchMedia('(pointer: fine)').matches) {
      event.preventDefault();
      onsubmit();
    }
  }
</script>

<textarea
  bind:this={field}
  bind:value
  class="input"
  rows="1"
  {placeholder}
  {maxlength}
  aria-label={placeholder}
  onkeydown={keydown}
  {oninput}
></textarea>

<style>
  .input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap-size);
    max-height: 140px;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-strong);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-md);
    line-height: var(--leading-normal);
    resize: none;
    outline: none;
    transition: border-color var(--duration-base) var(--ease-out);
  }

  .input:focus {
    border-color: var(--color-accent-2);
  }

  .input::placeholder {
    color: var(--color-text-subtle);
  }
</style>
