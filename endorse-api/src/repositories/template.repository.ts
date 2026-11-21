import { DataSource, Repository } from 'typeorm';
import { EndorsementTemplateModel } from '../models';

/** Puerto de acceso a plantillas (DIP): el servicio depende de esta interfaz. */
export interface TemplateRepository {
  findActive(productCode: string, endorsementTypeCode: string): Promise<EndorsementTemplateModel | null>;
  findAllActive(): Promise<EndorsementTemplateModel[]>;
}

const RELATIONS = {
  product: true,
  endorsementType: true,
  layout: { fields: true },
  dynamicFields: true,
  events: true,
} as const;

export class TypeOrmTemplateRepository implements TemplateRepository {
  private readonly repo: Repository<EndorsementTemplateModel>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(EndorsementTemplateModel);
  }

  findActive(productCode: string, endorsementTypeCode: string): Promise<EndorsementTemplateModel | null> {
    return this.repo.findOne({
      where: {
        isActive: true,
        product: { code: productCode, isActive: true },
        endorsementType: { code: endorsementTypeCode, isActive: true },
      },
      relations: RELATIONS,
      order: { version: 'DESC' },
    });
  }

  findAllActive(): Promise<EndorsementTemplateModel[]> {
    return this.repo.find({
      where: { isActive: true, product: { isActive: true }, endorsementType: { isActive: true } },
      relations: RELATIONS,
      order: { product: { code: 'ASC' }, endorsementType: { code: 'ASC' } },
    });
  }
}
