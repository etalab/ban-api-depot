import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateClientDTO {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ type: String, required: false })
  nom?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsMongoId()
  @ApiProperty({ type: String, required: false })
  mandataireId?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsMongoId()
  @ApiProperty({ type: String, required: false })
  chefDeFileId?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({ required: false })
  isActive?: boolean;

  @IsOptional()
  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({ required: false })
  isRelaxMode?: boolean;
}
