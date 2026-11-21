import { EndorsementTemplateModel } from '../../src/models';
import { TemplateRepository } from '../../src/repositories/template.repository';

export class InMemoryTemplateRepository implements TemplateRepository {
  constructor(private readonly templates: EndorsementTemplateModel[] = []) {}

  async findActive(productCode: string, endorsementTypeCode: string) {
    return (
      this.templates
        .filter(
          (t) => t.isActive && t.product.code === productCode && t.endorsementType.code === endorsementTypeCode,
        )
        .sort((a, b) => b.version - a.version)[0] ?? null
    );
  }

  async findAllActive() {
    return this.templates.filter((t) => t.isActive);
  }
}
