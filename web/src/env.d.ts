interface ImportMetaEnv {
  /** Both set: the app talks to Supabase. Both missing: it uses the in-browser backend. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
