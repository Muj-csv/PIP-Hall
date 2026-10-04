/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DATA_SOURCE?: 'fixture' | 'supabase';
  readonly VITE_PUBLIC_ORIGIN?: string;
  /** 'on' turns on PIP Progression (D-058). */
  readonly VITE_FEATURE_PIPS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
