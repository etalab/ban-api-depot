import { ApiProperty, OmitType } from '@nestjs/swagger';

import { PublicClient } from '@/modules/client/dto/public_client.dto';
import { Habilitation } from '../habilitation.entity';

export class HabilitationWithClientDTO extends OmitType(Habilitation, [
  'client',
]) {
  @ApiProperty({ type: () => PublicClient, required: false })
  client?: PublicClient;
}
