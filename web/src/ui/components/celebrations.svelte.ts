import type { Tone } from '../tone';

const LIFETIME_MS = 900;

class Celebrations {
  items = $state<{ id: number; tone: Tone }[]>([]);
  #nextId = 0;

  burst(tone: Tone): void {
    const id = this.#nextId++;
    this.items.push({ id, tone });
    setTimeout(() => (this.items = this.items.filter((item) => item.id !== id)), LIFETIME_MS);
  }
}

export const celebrations = new Celebrations();
