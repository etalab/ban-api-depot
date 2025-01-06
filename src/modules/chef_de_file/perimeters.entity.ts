import { ApiProperty } from '@nestjs/swagger';
import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ObjectId } from 'bson';
import { ChefDeFile } from './chef_de_file.entity';

export enum TypePerimeterEnum {
  COMMUNE = 'commune',
  DEPARTEMENT = 'departement',
  EPCI = 'epci',
}

@Entity({ name: 'perimeters' })
export class Perimeter {
  @ApiProperty()
  @PrimaryColumn('varchar', { length: 24 })
  id?: string;

  @BeforeInsert()
  generatedObjectId?() {
    this.id = new ObjectId().toHexString();
  }

  @Index('IDX_perimeters_chef_de_file_id')
  @ApiProperty()
  @Column('varchar', { length: 24, name: 'chef_de_file_id', nullable: false })
  chefDeFileId?: string;

  @ApiProperty({ enum: TypePerimeterEnum })
  @Column('enum', {
    enum: TypePerimeterEnum,
    nullable: false,
  })
  type: TypePerimeterEnum;

  @ApiProperty()
  @Column('text', { nullable: false })
  code: string;

  @ApiProperty({ type: () => ChefDeFile })
  @ManyToOne(() => ChefDeFile, (cdf) => cdf.perimeters, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'chef_de_file_id' })
  chefDeFile?: ChefDeFile;
}
