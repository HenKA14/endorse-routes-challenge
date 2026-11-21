import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { OutputLayoutModel } from './output-layout.model';

/**
 * Un campo del JSON de salida.
 *  - targetPath: ruta destino (ej. `riskUnitEntities[0].plansEntity.description`).
 *  - sourcePath: de dónde sale el valor (`input.plan`, `template.dynamicData`...).
 *  - defaultValue: valor JSON si el origen no viene (o constante si sourcePath es null).
 *  - sortOrder: orden de construcción -> orden de las claves en el JSON final.
 */
@Entity({ name: 'output_layout_field' })
@Unique('uq_layout_field_order', ['layout', 'sortOrder'])
@Unique('uq_layout_field_target', ['layout', 'targetPath'])
export class OutputLayoutFieldModel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => OutputLayoutModel, (layout) => layout.fields, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'layout_id' })
  layout: OutputLayoutModel;

  @Column({ name: 'target_path', type: 'varchar', length: 200 })
  targetPath: string;

  @Column({ name: 'source_path', type: 'varchar', length: 200, nullable: true })
  sourcePath: string | null;

  @Column({ name: 'default_value', type: 'jsonb', nullable: true })
  defaultValue: unknown;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;
}
