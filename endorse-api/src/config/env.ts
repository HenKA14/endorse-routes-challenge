export interface AppConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  corsOrigins: string[];
  database: {
    url: string;
    ssl: boolean;
    runMigrations: boolean;
    logging: boolean;
  };
  auth: {
    jwtSecret: string;
    issuer: string;
    audience: string;
    ttlSeconds: number;
    clientId: string;
    clientSecret: string;
  };
}

const DEV_SECRET = 'dev-only-secret-change-me-dev-only-secret';

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : ['1', 'true', 'yes'].includes(value.toLowerCase());

const required = (env: NodeJS.ProcessEnv, key: string, fallback?: string): string => {
  const value = env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variable de entorno requerida no definida: ${key}`);
  }
  return value;
};

/**
 * Carga y valida la configuración (fail-fast). En producción no hay valores por
 * defecto para secretos: si faltan, el servicio no arranca.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const nodeEnv = (env.NODE_ENV ?? 'development') as AppConfig['env'];
  const isProd = nodeEnv === 'production';
  const devFallback = (value: string) => (isProd ? undefined : value);

  const jwtSecret = required(env, 'JWT_SECRET', devFallback(DEV_SECRET));
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }

  return {
    env: nodeEnv,
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 3000),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    database: {
      url: required(env, 'DATABASE_URL', devFallback('postgres://localhost:5432/endorse_db')),
      ssl: bool(env.DB_SSL, false),
      runMigrations: bool(env.DB_RUN_MIGRATIONS, false),
      logging: bool(env.DB_LOGGING, false),
    },
    auth: {
      jwtSecret,
      issuer: env.JWT_ISSUER ?? 'endorse-api',
      audience: env.JWT_AUDIENCE ?? 'endorse-clients',
      ttlSeconds: Number(env.JWT_TTL_SECONDS ?? 3600),
      clientId: required(env, 'AUTH_CLIENT_ID', devFallback('frontend-demo')),
      clientSecret: required(env, 'AUTH_CLIENT_SECRET', devFallback('frontend-demo-secret')),
    },
  };
};
