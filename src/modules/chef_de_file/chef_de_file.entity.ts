import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany } from 'typeorm';
import { IdEntity } from '../../lib/class/entity/id.entity';
import { Client } from '../client/client.entity';
import { Perimeter } from './perimeters.entity';

@Entity({ name: 'chefs_de_file' })
export class ChefDeFile extends IdEntity {
  @ApiProperty()
  @Column('text', { nullable: false })
  nom: string;

  @ApiProperty()
  @Column('text', { nullable: false })
  email?: string;

  @ApiProperty()
  @Column('boolean', {
    nullable: true,
    default: false,
    name: 'is_email_public',
  })
  isEmailPublic: boolean;

  @ApiProperty()
  @Column('boolean', {
    nullable: true,
    default: false,
    name: 'is_signataire_charte',
  })
  isSignataireCharte: boolean;

  @ApiProperty({ type: () => Client, isArray: true })
  @OneToMany(() => Client, (c) => c.chefDeFile)
  clients?: Client[];

  @ApiProperty({ type: () => Perimeter, isArray: true })
  @OneToMany(() => Perimeter, (perimeter) => perimeter.chefDeFile, {
    eager: true,
    cascade: true,
  })
  perimeters?: Perimeter[] | [];
}
