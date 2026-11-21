import { loadConfig } from '../../../src/config/env';

describe('loadConfig', () => {
  it('usa valores por defecto seguros en desarrollo', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({ env: 'development', port: 3000, corsOrigins: ['http://localhost:5173'] });
    expect(config.database.runMigrations).toBe(false);
  });

  it('parsea listas y booleanos', () => {
    const config = loadConfig({
      CORS_ORIGINS: 'https://a.com, https://b.com,',
      DB_SSL: 'true',
      DB_RUN_MIGRATIONS: 'YES',
      DB_LOGGING: '0',
      PORT: '8080',
    });
    expect(config.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(config.database).toMatchObject({ ssl: true, runMigrations: true, logging: false });
    expect(config.port).toBe(8080);
  });

  it('en producción exige los secretos (fail-fast)', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('JWT_SECRET');
    expect(() =>
      loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32), AUTH_CLIENT_ID: 'a', AUTH_CLIENT_SECRET: 'b' }),
    ).toThrow('DATABASE_URL');
  });

  it('rechaza secretos JWT cortos', () => {
    expect(() => loadConfig({ JWT_SECRET: 'corto' })).toThrow('al menos 32');
  });
});
