import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { EndorsementTemplateModel } from './endorsement-template.model';

/**
 * Elemento de `eventEntity.dynamicData` ({ etiqueta, value }).
 *  - sourceField: campo del JSON plano de entrada (null = constante).
 *  - defaultValue: valor si el campo no se envía.
 *  - isRequired: si no se envía y no hay default -> error 422.
 */
@Entity({ name: 'template_dynamic_field' })
@Unique('uq_dynamic_field_order', ['template', 'sortOrder'])
@Unique('uq_dynamic_field_label', ['template', 'label'])
export class TemplateDynamicFieldModel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EndorsementTemplateModel, (t) => t.dynamicFields, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'template_id' })
  template: EndorsementTemplateModel;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ name: 'source_field', type: 'varchar', length: 100, nullable: true })
  sourceField: string | null;

  @Column({ name: 'default_value', type: 'jsonb', nullable: true })
  defaultValue: unknown;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;
}
