// Post-build para Netlify: genera dist/config.js (configuración de runtime) y
// dist/_headers (cabeceras de seguridad), igual que nginx en el contenedor.
// Uso: ENDORSE_API_URL=... ROUTES_API_URL=... CLIENT_ID=... CLIENT_SECRET=... node scripts/netlify-postbuild.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'dist';

/** Exige una URL http(s) sin ruta (solo el origen) para usarla en la CSP. */
const origin = (name) => {
  const raw = process.env[name];
  if (!raw) throw new Error(`Falta la variable ${name}`);
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} debe ser http(s): ${raw}`);
  }
  return url.origin;
};

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}`);
  return value;
};

const config = {
  endorseApiUrl: origin('ENDORSE_API_URL'),
  routesApiUrl: origin('ROUTES_API_URL'),
  clientId: required('CLIENT_ID'),
  clientSecret: required('CLIENT_SECRET'),
};

writeFileSync(join(outDir, 'config.js'), `window.__APP_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  `connect-src 'self' ${config.endorseApiUrl} ${config.routesApiUrl}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const headers = `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/config.js
  Cache-Control: no-store
`;

writeFileSync(join(outDir, '_headers'), headers);

console.log(`netlify-postbuild: config.js y _headers generados (APIs: ${config.endorseApiUrl}, ${config.routesApiUrl})`);
