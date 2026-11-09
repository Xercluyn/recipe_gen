// Base URL of the Cloudflare Worker that generates recipes (see api/).
// Override at build time with VITE_API_URL.
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://recipe-gen-api.recipe-gen.workers.dev';
