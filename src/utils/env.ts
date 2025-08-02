// Simple environment configuration - trust Vite works
export const config = {
  esv: {
    apiKey: import.meta.env.VITE_ESV_API_KEY,
    baseUrl: import.meta.env.VITE_ESV_API_BASE_URL,
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  app: {
    title: import.meta.env.VITE_APP_TITLE,
    version: import.meta.env.VITE_APP_VERSION,
  },
} as const;