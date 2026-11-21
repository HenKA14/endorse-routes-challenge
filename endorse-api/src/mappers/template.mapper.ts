import {
  DynamicFieldConfig,
  LayoutFieldConfig,
  TemplateConfig,
  TemplateInputField,
  TemplateSummaryDto,
} from '../entities/template-config.entity';
import { InvalidTemplateError } from '../errors/domain.errors';
import { EndorsementTemplateModel } from '../models';
import { isValidPath } from '../utils/object-path';

const SOURCE_ROOTS = ['input.', 'template.'];
const INPUT_PREFIX = 'input.';
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

const hasValue = (v: unknown): boolean => v !== null && v !== undefined;
const byOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/**
 * Mapper Model (ORM) -> TemplateConfig (dominio). Además de ordenar, valida la
 * configuración para que un error de datos en BD falle de forma explícita y no
 * genere un JSON corrupto para el core.
 */
export class TemplateMapper {
  static toConfig(model: EndorsementTemplateModel): TemplateConfig {
    const errors: string[] = [];

    const layoutFields: LayoutFieldConfig[] = [...(model.layout?.fields ?? [])].sort(byOrder).map((f) => {
      if (!isValidPath(f.targetPath)) errors.push(`targetPath inválido: ${f.targetPath}`);
      if (f.sourcePath !== null && (!SOURCE_ROOTS.some((r) => f.sourcePath!.startsWith(r)) || !isValidPath(f.sourcePath))) {
        errors.push(`sourcePath inválido: ${f.sourcePath}`);
      }
      if (f.sourcePath === null && !hasValue(f.defaultValue)) {
        errors.push(`El campo ${f.targetPath} no tiene origen ni valor por defecto`);
      }
      return {
        targetPath: f.targetPath,
        sourcePath: f.sourcePath,
        defaultValue: f.defaultValue ?? null,
        isRequired: f.isRequired,
      };
    });

    const dynamicFields: DynamicFieldConfig[] = [...(model.dynamicFields ?? [])].sort(byOrder).map((f) => {
      if (f.sourceField !== null && (!FIELD_NAME.test(f.sourceField) || !isValidPath(f.sourceField))) {
        errors.push(`sourceField inválido en etiqueta ${f.label}: ${f.sourceField}`);
      }
      if (f.sourceField === null && !hasValue(f.defaultValue)) {
        errors.push(`La etiqueta ${f.label} no tiene origen ni valor por defecto`);
      }
      return {
        label: f.label,
        sourcePath: f.sourceField,
        defaultValue: f.defaultValue ?? null,
        isRequired: f.isRequired,
      };
    });

    if (layoutFields.length === 0) errors.push('El layout no tiene campos configurados');

    if (errors.length > 0) {
      throw new InvalidTemplateError(`La plantilla ${model.id} tiene configuración inválida`, { errors });
    }

    return {
      id: model.id,
      version: model.version,
      productCode: model.product.code,
      endorsementTypeCode: model.endorsementType.code,
      layoutCode: model.layout.code,
      eventDescription: model.eventDescription,
      layoutFields,
      dynamicFields,
      events: [...(model.events ?? [])]
        .sort((a, b) => a.orderEvent - b.orderEvent)
        .map((e) => ({ description: e.description, orderEvent: e.orderEvent })),
    };
  }

  /** Campos del JSON plano que la plantilla consume (para formularios dinámicos). */
  static toSummary(config: TemplateConfig): TemplateSummaryDto {
    const fields = new Map<string, TemplateInputField>();
    const add = (name: string, isRequired: boolean, defaultValue: unknown) => {
      const mustSend = isRequired && !hasValue(defaultValue);
      const prev = fields.get(name);
      fields.set(name, {
        name,
        required: (prev?.required ?? false) || mustSend,
        defaultValue: prev && hasValue(prev.defaultValue) ? prev.defaultValue : defaultValue,
      });
    };

    add('producto', true, null);
    add('tipoEndoso', true, null);
    config.layoutFields
      .filter((f) => f.sourcePath?.startsWith(INPUT_PREFIX))
      .forEach((f) => add(f.sourcePath!.slice(INPUT_PREFIX.length), f.isRequired, f.defaultValue));
    config.dynamicFields
      .filter((f) => f.sourcePath !== null)
      .forEach((f) => add(f.sourcePath!, f.isRequired, f.defaultValue));

    return {
      producto: config.productCode,
      tipoEndoso: config.endorsementTypeCode,
      version: config.version,
      layout: config.layoutCode,
      inputFields: [...fields.values()],
    };
  }
}
