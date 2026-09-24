<div class="background" aria-hidden="true">
  <span class="blob one"></span>
  <span class="blob two"></span>
  <span class="blob three"></span>
  <span class="grain"></span>
</div>

<style>
  .background {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background: var(--color-bg);
  }

  .blob {
    position: absolute;
    width: 70vmax;
    height: 70vmax;
    border-radius: 50%;
    filter: blur(60px);
    animation: drift 18s ease-in-out infinite alternate;
  }

  .one {
    top: -30vmax;
    left: -25vmax;
    background: radial-gradient(circle, var(--color-bg-glow-1), transparent 65%);
  }

  .two {
    top: 20vh;
    right: -35vmax;
    background: radial-gradient(circle, var(--color-bg-glow-2), transparent 65%);
    animation-duration: 22s;
    animation-direction: alternate-reverse;
  }

  .three {
    bottom: -40vmax;
    left: -10vmax;
    background: radial-gradient(circle, var(--color-bg-glow-3), transparent 65%);
    animation-duration: 26s;
  }

  .grain {
    position: absolute;
    inset: 0;
    opacity: 0.05;
    background-image: radial-gradient(var(--color-text) 1px, transparent 1px);
    background-size: 3px 3px;
  }

  @keyframes drift {
    to {
      transform: translate(8vmax, 6vmax) scale(1.15);
    }
  }
</style>
