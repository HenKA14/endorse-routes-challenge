import { DataSource } from 'typeorm';
import { AppConfig } from './config/env';
import { AuthController } from './controllers/auth.controller';
import { EndorseController } from './controllers/endorse.controller';
import { HealthController, HealthProbe } from './controllers/health.controller';
import { TemplateController } from './controllers/template.controller';
import { TemplateRepository, TypeOrmTemplateRepository } from './repositories/template.repository';
import { AuthService } from './services/auth.service';
import { EndorseTranslatorService } from './services/endorse-translator.service';
import { TemplateService } from './services/template.service';
import { V1Controllers } from './routes/v1';

export interface Container {
  health: HealthController;
  v1: V1Controllers;
}

export interface Infrastructure {
  templateRepository: TemplateRepository;
  dbProbe: HealthProbe;
}

/** Composition root: único lugar donde se instancian las implementaciones. */
export const buildContainer = (config: AppConfig, infra: Infrastructure): Container => ({
  health: new HealthController(infra.dbProbe),
  v1: {
    endorse: new EndorseController(new EndorseTranslatorService(infra.templateRepository)),
    templates: new TemplateController(new TemplateService(infra.templateRepository)),
    auth: new AuthController(new AuthService(config.auth)),
  },
});

export const typeOrmInfrastructure = (dataSource: DataSource): Infrastructure => ({
  templateRepository: new TypeOrmTemplateRepository(dataSource),
  dbProbe: async () => {
    await dataSource.query('SELECT 1');
  },
});
