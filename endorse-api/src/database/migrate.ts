import { loadConfig } from '../config/env';
import { createDataSource } from './data-source';

/** Ejecuta migraciones pendientes (job de despliegue / `npm run db:migrate`). */
const main = async () => {
  try {
    process.loadEnvFile();
  } catch {
    /* sin .env: se usan variables del entorno */
  }
  const dataSource = createDataSource(loadConfig().database);
  await dataSource.initialize();
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(`Migraciones aplicadas: ${applied.map((m) => m.name).join(', ') || 'ninguna (al día)'}`);
  await dataSource.destroy();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
