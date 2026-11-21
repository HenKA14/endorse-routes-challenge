import { AppliedEvent, DynamicDataItem, TranslationResult } from '../entities/core-endorsement.entity';
import { TemplateConfig } from '../entities/template-config.entity';
import { TranslateRequestDto } from '../entities/translate-request.entity';
import { MissingField, MissingRequiredFieldsError, TemplateNotFoundError } from '../errors/domain.errors';
import { CorePayloadMapper, ResolvedField } from '../mappers/core-payload.mapper';
import { TemplateMapper } from '../mappers/template.mapper';
import { TemplateRepository } from '../repositories/template.repository';
import { ValueResolver } from './value-resolver';

const INPUT_PREFIX = /^input\./;

/**
 * Caso de uso: traducir un endoso plano al JSON del core.
 * No contiene ninguna regla específica de producto/tipo de endoso: todo sale
 * de la plantilla (OCP: nuevos productos = nuevas filas, no nuevo código).
 */
export class EndorseTranslatorService {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly resolver: ValueResolver = new ValueResolver(),
    private readonly payloadMapper: CorePayloadMapper = new CorePayloadMapper(),
  ) {}

  async translate(request: TranslateRequestDto): Promise<TranslationResult> {
    const model = await this.templates.findActive(request.producto, request.tipoEndoso);
    if (!model) {
      throw new TemplateNotFoundError(request.producto, request.tipoEndoso);
    }

    const template = TemplateMapper.toConfig(model);
    const missing: MissingField[] = [];

    const dynamicData = this.buildDynamicData(template, request, missing);
    const appliedEvents: AppliedEvent[] = template.events.map(({ description, orderEvent }) => ({
      description,
      orderEvent,
    }));

    const context = {
      input: request,
      template: { eventDescription: template.eventDescription, dynamicData, appliedEvents },
    };

    const resolved: ResolvedField[] = template.layoutFields.map((field) => {
      const result = this.resolver.resolve(field, context);
      if (!result.ok) {
        missing.push({ field: field.sourcePath?.replace(INPUT_PREFIX, '') ?? field.targetPath, target: field.targetPath });
      }
      return { targetPath: field.targetPath, value: result.ok ? result.value : null };
    });

    if (missing.length > 0) {
      throw new MissingRequiredFieldsError(missing);
    }

    return {
      payload: this.payloadMapper.build(resolved),
      templateId: template.id,
      templateVersion: template.version,
    };
  }

  private buildDynamicData(
    template: TemplateConfig,
    request: TranslateRequestDto,
    missing: MissingField[],
  ): DynamicDataItem[] {
    return template.dynamicFields.map((field) => {
      const result = this.resolver.resolve(field, request);
      if (!result.ok) {
        missing.push({ field: field.sourcePath ?? field.label, target: `eventEntity.dynamicData.${field.label}` });
      }
      return { etiqueta: field.label, value: result.ok ? result.value : null };
    });
  }
}
