import { TemplateSummaryDto } from '../entities/template-config.entity';
import { InvalidTemplateError } from '../errors/domain.errors';
import { TemplateMapper } from '../mappers/template.mapper';
import { TemplateRepository } from '../repositories/template.repository';

export interface Logger {
  warn(message: string, data?: unknown): void;
}

/** Catálogo de plantillas activas para el frontend (formulario dinámico). */
export class TemplateService {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly logger: Logger = console,
  ) {}

  async listActive(): Promise<TemplateSummaryDto[]> {
    const models = await this.templates.findAllActive();
    const summaries: TemplateSummaryDto[] = [];
    for (const model of models) {
      try {
        summaries.push(TemplateMapper.toSummary(TemplateMapper.toConfig(model)));
      } catch (error) {
        if (!(error instanceof InvalidTemplateError)) throw error;
        // Una plantilla mal configurada no debe tumbar el catálogo completo.
        this.logger.warn(error.message, error.details);
      }
    }
    return summaries;
  }
}
