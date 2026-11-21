/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_ENDORSE_API_URL?: string;
  readonly VITE_ROUTES_API_URL?: string;
  readonly VITE_CLIENT_ID?: string;
  readonly VITE_CLIENT_SECRET?: string;
}

interface Window {
  /** Configuración inyectada en runtime por el contenedor (public/config.js). */
  __APP_CONFIG__?: Partial<Record<'endorseApiUrl' | 'routesApiUrl' | 'clientId' | 'clientSecret', string>>;
}
