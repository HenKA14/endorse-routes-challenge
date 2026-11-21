import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EndorsementTypeModel } from './endorsement-type.model';
import { OutputLayoutModel } from './output-layout.model';
import { ProductModel } from './product.model';
import { TemplateDynamicFieldModel } from './template-dynamic-field.model';
import { TemplateEventModel } from './template-event.model';

/**
 * Plantilla versionada por producto + tipo de endoso. Solo una versión activa
 * por combinación (índice único parcial creado en la migración).
 */
@Entity({ name: 'endorsement_template' })
@Unique('uq_template_version', ['product', 'endorsementType', 'version'])
@Index('ix_template_lookup', ['product', 'endorsementType', 'isActive'])
export class EndorsementTemplateModel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductModel, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: ProductModel;

  @ManyToOne(() => EndorsementTypeModel, { nullable: false })
  @JoinColumn({ name: 'endorsement_type_id' })
  endorsementType: EndorsementTypeModel;

  @ManyToOne(() => OutputLayoutModel, { nullable: false })
  @JoinColumn({ name: 'layout_id' })
  layout: OutputLayoutModel;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'event_description', type: 'varchar', length: 100 })
  eventDescription: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => TemplateDynamicFieldModel, (field) => field.template, { cascade: true })
  dynamicFields: TemplateDynamicFieldModel[];

  @OneToMany(() => TemplateEventModel, (event) => event.template, { cascade: true })
  events: TemplateEventModel[];
}
