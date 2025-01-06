import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { IdEntity } from '../../lib/class/entity/id.entity';
import { Mandataire } from '../mandataire/mandataire.entity';
import { ChefDeFile } from '../chef_de_file/chef_de_file.entity';
import { Revision } from '../revision/revision.entity';
import { Habilitation } from '../habilitation/habilitation.entity';

export enum AuthorizationStrategyEnum {
  INTERNAL = 'internal',
  CHEF_DE_FILE = 'chef-de-file',
  HABILITATION = 'habilitation',
}

@Entity({ name: 'clients' })
export class Client extends IdEntity {
  @Index('IDX_client_mandataire_id')
  @ApiProperty()
  @Column('varchar', { length: 24, name: 'mandataire_id', nullable: false })
  mandataireId?: string;

  @Index('IDX_client_chef_de_file_id')
  @ApiProperty()
  @Column('varchar', { length: 24, name: 'chef_de_file_id', nullable: true })
  chefDeFileId?: string;

  @ApiProperty()
  @Column('text', { nullable: true, name: 'legacy_id' })
  legacyId: string;

  @ApiProperty()
  @Column('text', { nullable: false })
  nom: string;

  @ApiProperty()
  @Column('boolean', { nullable: true, default: true, name: 'is_active' })
  isActive: boolean;

  @ApiProperty()
  @Column('boolean', { nullable: true, default: true, name: 'is_relax_mode' })
  isRelaxMode: boolean;

  @ApiProperty()
  @Column('varchar', { length: 32, nullable: false })
  token?: string;

  @ApiProperty({ enum: AuthorizationStrategyEnum })
  @Column('enum', {
    enum: AuthorizationStrategyEnum,
    nullable: false,
    name: 'authorization_strategy',
    enumName: 'authorization_strategy_enum',
  })
  authorizationStrategy: AuthorizationStrategyEnum;

  @ApiProperty({ type: () => Mandataire })
  @ManyToOne(() => Mandataire, (m) => m.clients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mandataire_id' })
  mandataire?: Mandataire;

  @ApiProperty({ type: () => ChefDeFile })
  @ManyToOne(() => ChefDeFile, (m) => m.clients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chef_de_file_id' })
  chefDeFile?: ChefDeFile;

  @ApiProperty({ type: () => Revision, isArray: true })
  @OneToMany(() => Revision, (r) => r.client)
  revisions?: Revision[];

  @ApiProperty({ type: () => Habilitation, isArray: true })
  @OneToMany(() => Habilitation, (h) => h.client)
  habilitations?: Habilitation[];
}
