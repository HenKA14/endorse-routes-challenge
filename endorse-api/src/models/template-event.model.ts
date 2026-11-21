import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { EndorsementTemplateModel } from './endorsement-template.model';

/** Elemento de `eventAppliedEntities` ({ description, orderEvent }). */
@Entity({ name: 'template_event' })
@Unique('uq_template_event_order', ['template', 'orderEvent'])
export class TemplateEventModel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EndorsementTemplateModel, (t) => t.events, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'template_id' })
  template: EndorsementTemplateModel;

  @Column({ type: 'varchar', length: 100 })
  description: string;

  @Column({ name: 'order_event', type: 'int' })
  orderEvent: number;
}
