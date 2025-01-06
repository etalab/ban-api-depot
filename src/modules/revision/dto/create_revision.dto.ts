import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Context } from '../revision.entity';

export class ContextDTO implements Context {
  @IsString()
  @IsOptional()
  @ApiProperty({ type: String, required: false })
  nomComplet?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ type: String, required: false })
  organisation?: string;

  @IsObject()
  @IsOptional()
  @ApiProperty({ type: () => Object, required: false })
  extras?: Record<string, any>;
}

export class CreateRevisionDTO {
  @IsObject()
  @ValidateNested()
  @Type(() => ContextDTO)
  @ApiProperty({ type: () => ContextDTO, required: true })
  context?: ContextDTO;
}
