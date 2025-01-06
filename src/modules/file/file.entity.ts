import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Revision } from '../revision/revision.entity';

export enum TypeFileEnum {
  BAL = 'bal',
}

@Entity({ name: 'files' })
export class File {
  @ApiProperty()
  @PrimaryColumn('varchar', { length: 24 })
  id?: string;

  @Index('IDX_file_revision_id')
  @ApiProperty()
  @Column('varchar', { length: 24, name: 'revision_id', nullable: false })
  revisionId?: string;

  @ApiProperty()
  @Column('integer', { nullable: true })
  size: number;

  @ApiProperty()
  @Column('text', { nullable: false, default: false })
  hash: string;

  @ApiProperty({ enum: TypeFileEnum })
  @Column('enum', {
    enum: TypeFileEnum,
    default: TypeFileEnum.BAL,
    name: 'type',
    enumName: 'type_file_enum',
  })
  type: TypeFileEnum;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ type: () => Revision })
  @ManyToOne(() => Revision, (r) => r.files, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'revision_id' })
  revision?: Revision;
}
