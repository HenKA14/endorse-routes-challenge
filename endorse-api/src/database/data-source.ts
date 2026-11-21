import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AppConfig } from '../config/env';
import { ALL_MODELS } from '../models';
import { InitSchema1732190000000 } from './migrations/1732190000000-InitSchema';
import { SeedReferenceData1732190000001 } from './migrations/1732190000001-SeedReferenceData';

export const createDataSource = (config: AppConfig['database']): DataSource =>
  new DataSource({
    type: 'postgres',
    url: config.url,
    ssl: config.ssl ? { rejectUnauthorized: true } : false,
    entities: ALL_MODELS,
    migrations: [InitSchema1732190000000, SeedReferenceData1732190000001],
    migrationsTableName: 'typeorm_migrations',
    // El esquema lo gobiernan las migraciones, nunca `synchronize`.
    synchronize: false,
    logging: config.logging,
    extra: { max: 10, connectionTimeoutMillis: 5000 },
  });
