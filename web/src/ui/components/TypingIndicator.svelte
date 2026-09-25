<!-- "Sta scrivendo…": three dots in a bubble, like WhatsApp and Instagram. -->
<div class="bubble" role="status" aria-label="Sta scrivendo">
  <span class="dot"></span>
  <span class="dot"></span>
  <span class="dot"></span>
</div>

<style>
  .bubble {
    display: inline-flex;
    justify-self: start;
    width: max-content;
    align-items: center;
    gap: 4px;
    margin-top: var(--space-3);
    padding: 12px 14px;
    border-radius: 18px 18px 18px 6px;
    background: var(--color-bubble-in);
    border: 1px solid var(--color-bubble-in-border);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-text-muted);
    animation: bounce 1.2s infinite var(--ease-out);
  }

  .dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes bounce {
    0%,
    60%,
    100% {
      translate: 0 0;
      opacity: 0.5;
    }
    30% {
      translate: 0 -4px;
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
