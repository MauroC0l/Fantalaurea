import type { Clipboard } from '../../application/ports';

export function browserClipboard(): Clipboard {
  return {
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    },
  };
}
