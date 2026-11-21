/** Regla común de resolución de un valor: origen -> default -> obligatorio. */
export interface ValueRule {
  sourcePath: string | null;
  defaultValue: unknown;
  isRequired: boolean;
}

export interface LayoutFieldConfig extends ValueRule {
  targetPath: string;
}

export interface DynamicFieldConfig extends ValueRule {
  label: string;
}

export interface EventConfig {
  description: string;
  orderEvent: number;
}

/** Plantilla ya resuelta y ordenada, independiente del ORM. */
export interface TemplateConfig {
  id: number;
  version: number;
  productCode: string;
  endorsementTypeCode: string;
  layoutCode: string;
  eventDescription: string;
  layoutFields: LayoutFieldConfig[];
  dynamicFields: DynamicFieldConfig[];
  events: EventConfig[];
}

export interface TemplateInputField {
  name: string;
  required: boolean;
  defaultValue: unknown;
}

/** Resumen de plantilla para que el frontend arme el formulario dinámico. */
export interface TemplateSummaryDto {
  producto: string;
  tipoEndoso: string;
  version: number;
  layout: string;
  inputFields: TemplateInputField[];
}
