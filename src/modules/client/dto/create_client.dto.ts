import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateClientDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ type: String, required: true })
  nom: string;

  @IsNotEmpty()
  @IsMongoId()
  @ApiProperty({ type: String, required: true })
  mandataireId: string;

  @IsOptional()
  @IsNotEmpty()
  @IsMongoId()
  @ApiProperty({ type: String, required: false })
  chefDeFileId?: string;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;

  @IsOptional()
  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({ type: Boolean, required: false })
  isRelaxMode?: boolean;
}
