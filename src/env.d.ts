/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ESV_API_KEY: string;
  readonly VITE_ESV_API_BASE_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}