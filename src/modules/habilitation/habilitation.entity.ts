import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { IdEntity } from '../../lib/class/entity/id.entity';
import { Client } from '../client/client.entity';

export enum StatusHabilitationEnum {
  ACCEPTED = 'accepted',
  PENDING = 'pending',
  REJECTED = 'rejected',
}

export enum TypeStrategyEnum {
  EMAIL = 'email',
  FRANCECONNECT = 'franceconnect',
  INTERNAL = 'internal',
}

export interface Mandat {
  nomMarital: string;
  nomNaissance: string;
  prenom: string;
}

export class Strategy {
  @ApiProperty({ enum: TypeStrategyEnum, required: false })
  type: TypeStrategyEnum;

  // EMAIL

  @ApiProperty({ type: String, required: false })
  pinCode?: string;

  @ApiProperty({ type: Date, required: false })
  pinCodeExpiration?: Date | null;

  @ApiProperty({ type: Date, required: false })
  createdAt?: Date | null;

  @ApiProperty({ type: Number, required: false })
  remainingAttempts?: number;

  // FRANCECONNECT

  @ApiProperty({ type: Object, required: false })
  mandat?: Mandat;

  @ApiProperty({ type: String, required: false })
  authenticationError?: string;
}

@Entity({ name: 'habilitations' })
export class Habilitation extends IdEntity {
  @Index('IDX_habilitation_client_id')
  @ApiProperty()
  @Column('varchar', { length: 24, name: 'client_id', nullable: false })
  clientId?: string;

  @ApiProperty()
  @Column('text', { nullable: true, name: 'code_commune' })
  codeCommune: string;

  @ApiProperty()
  @Column('text', { nullable: true, array: true, name: 'emails_commune' })
  emailsCommune: string[];

  @ApiProperty()
  @Column('text', {
    nullable: true,
    name: 'franceconnect_authentication_url',
  })
  franceconnectAuthenticationUrl: string;

  @ApiProperty({ enum: StatusHabilitationEnum })
  @Column('enum', {
    enum: StatusHabilitationEnum,
    nullable: false,
    name: 'status',
    enumName: 'status_habilitation_enum',
  })
  status: StatusHabilitationEnum;

  @ApiProperty({ type: () => Strategy })
  @Column('jsonb', { nullable: true })
  strategy: Strategy | null;

  @ApiProperty()
  @Column('timestamp', { name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @ApiProperty()
  @Column('timestamp', { name: 'accepted_at', nullable: true })
  acceptedAt?: Date;

  @ApiProperty()
  @Column('timestamp', { name: 'rejected_at', nullable: true })
  rejectedAt?: Date;

  @ApiProperty({ type: () => Client })
  @ManyToOne(() => Client, (c) => c.habilitations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_id' })
  client?: Client;
}
