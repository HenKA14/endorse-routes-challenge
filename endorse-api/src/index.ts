import 'reflect-metadata';
import { loadConfig } from './config/env';
import { buildContainer, typeOrmInfrastructure } from './container';
import { createDataSource } from './database/data-source';
import { createServer } from './server';

const bootstrap = async () => {
  try {
    process.loadEnvFile();
  } catch {
    /* sin .env: se usan variables del entorno (Cloud Run / Docker) */
  }

  const config = loadConfig();
  const dataSource = createDataSource(config.database);
  await dataSource.initialize();
  if (config.database.runMigrations) {
    await dataSource.runMigrations({ transaction: 'each' });
  }

  const server = await createServer(config, buildContainer(config, typeOrmInfrastructure(dataSource)));
  await server.start();
  console.log(JSON.stringify({ severity: 'INFO', message: `endorse-api escuchando en ${server.info.uri}` }));

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ severity: 'INFO', message: `${signal} recibido, cerrando` }));
    await server.stop({ timeout: 10_000 });
    await dataSource.destroy();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

bootstrap().catch((error) => {
  console.error(JSON.stringify({ severity: 'CRITICAL', message: 'Error al iniciar', error: String(error) }));
  process.exit(1);
});
