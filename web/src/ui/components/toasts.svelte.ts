export type ToastTone = 'info' | 'error';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

const VISIBLE_MS = 3500;

class Toasts {
  items = $state<Toast[]>([]);
  #nextId = 0;

  show(message: string, tone: ToastTone = 'info'): void {
    if (this.items.some((toast) => toast.message === message)) return;
    const id = this.#nextId++;
    this.items.push({ id, message, tone });
    setTimeout(() => this.dismiss(id), VISIBLE_MS);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((toast) => toast.id !== id);
  }
}

export const toasts = new Toasts();
