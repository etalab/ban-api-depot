import { ApiProperty } from '@nestjs/swagger';

export class PublicClient {
  @ApiProperty({ type: String, required: false })
  id: string;

  @ApiProperty({ type: String, required: false })
  legacyId?: string;

  @ApiProperty({ type: String, required: false })
  nom: string;

  @ApiProperty({ type: String, required: false })
  mandataire: string;

  @ApiProperty({ type: String, required: false })
  chefDeFile?: string;

  @ApiProperty({ type: String, required: false })
  chefDeFileEmail?: string;
}
