const runtime = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};

/** Runtime (config.js del contenedor) > build-time (VITE_*) > valores locales. */
export const appConfig = {
  endorseApiUrl: runtime.endorseApiUrl || import.meta.env.VITE_ENDORSE_API_URL || 'http://localhost:3000',
  routesApiUrl: runtime.routesApiUrl || import.meta.env.VITE_ROUTES_API_URL || 'http://localhost:8080',
  clientId: runtime.clientId || import.meta.env.VITE_CLIENT_ID || 'frontend-demo',
  clientSecret: runtime.clientSecret || import.meta.env.VITE_CLIENT_SECRET || 'frontend-demo-secret',
};

export const clientCredentials = { clientId: appConfig.clientId, clientSecret: appConfig.clientSecret };
