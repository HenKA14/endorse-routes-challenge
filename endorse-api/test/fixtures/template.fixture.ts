import {
  EndorsementTemplateModel,
  EndorsementTypeModel,
  OutputLayoutFieldModel,
  OutputLayoutModel,
  ProductModel,
  TemplateDynamicFieldModel,
  TemplateEventModel,
} from '../../src/models';
import { CORE_LAYOUT_V1, LayoutFieldSeed, TemplateSeed } from '../../src/database/seeds/reference-data';

let seq = 1;

export const buildLayout = (fields: LayoutFieldSeed[] = CORE_LAYOUT_V1.fields, code = CORE_LAYOUT_V1.code) =>
  Object.assign(new OutputLayoutModel(), {
    id: seq++,
    code,
    description: code,
    fields: fields.map((f, i) =>
      Object.assign(new OutputLayoutFieldModel(), {
        id: seq++,
        targetPath: f.targetPath,
        sourcePath: f.sourcePath ?? null,
        defaultValue: f.defaultValue ?? null,
        isRequired: f.isRequired ?? false,
        sortOrder: i + 1,
      }),
    ),
  });

/** Construye el mismo modelo que produce la migración de seed a partir del seed. */
export const buildTemplateModel = (
  seed: TemplateSeed,
  options: { id?: number; layout?: OutputLayoutModel; shuffle?: boolean } = {},
): EndorsementTemplateModel => {
  const dynamicFields = seed.dynamicFields.map((f, i) =>
    Object.assign(new TemplateDynamicFieldModel(), {
      id: seq++,
      label: f.label,
      sourceField: f.sourceField ?? null,
      defaultValue: f.defaultValue ?? null,
      isRequired: f.isRequired ?? false,
      sortOrder: i + 1,
    }),
  );
  const events = seed.events.map((description, i) =>
    Object.assign(new TemplateEventModel(), { id: seq++, description, orderEvent: i + 1 }),
  );
  const layout = options.layout ?? buildLayout();

  if (options.shuffle) {
    // La BD no garantiza orden en relaciones: el mapper debe ordenar.
    dynamicFields.reverse();
    events.reverse();
    layout.fields.reverse();
  }

  return Object.assign(new EndorsementTemplateModel(), {
    id: options.id ?? seq++,
    version: seed.version,
    eventDescription: seed.eventDescription,
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    product: Object.assign(new ProductModel(), { id: 1, code: seed.product, name: seed.product, isActive: true }),
    endorsementType: Object.assign(new EndorsementTypeModel(), {
      id: 1,
      code: seed.endorsementType,
      name: seed.endorsementType,
      isActive: true,
    }),
    layout,
    dynamicFields,
    events,
  });
};
