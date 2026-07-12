/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL; defaults to '/api/v1' (Vite dev proxy) when unset. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
