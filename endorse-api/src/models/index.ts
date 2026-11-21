import { EndorsementTemplateModel } from './endorsement-template.model';
import { EndorsementTypeModel } from './endorsement-type.model';
import { OutputLayoutFieldModel } from './output-layout-field.model';
import { OutputLayoutModel } from './output-layout.model';
import { ProductModel } from './product.model';
import { TemplateDynamicFieldModel } from './template-dynamic-field.model';
import { TemplateEventModel } from './template-event.model';

export {
  EndorsementTemplateModel,
  EndorsementTypeModel,
  OutputLayoutFieldModel,
  OutputLayoutModel,
  ProductModel,
  TemplateDynamicFieldModel,
  TemplateEventModel,
};

export const ALL_MODELS = [
  ProductModel,
  EndorsementTypeModel,
  OutputLayoutModel,
  OutputLayoutFieldModel,
  EndorsementTemplateModel,
  TemplateDynamicFieldModel,
  TemplateEventModel,
];
