import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany } from 'typeorm';
import { IdEntity } from '../../lib/class/entity/id.entity';
import { Client } from '../client/client.entity';

@Entity({ name: 'mandataires' })
export class Mandataire extends IdEntity {
  @ApiProperty()
  @Column('text', { nullable: false })
  nom: string;

  @ApiProperty()
  @Column('text', { nullable: false })
  email: string;

  @ApiProperty({ type: () => Client, isArray: true })
  @OneToMany(() => Client, (c) => c.mandataire)
  clients?: Client[];
}
