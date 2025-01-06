import { Revision } from '../revision.entity';
import { ApiProperty, OmitType } from '@nestjs/swagger';

import { PublicClient } from '@/modules/client/dto/public_client.dto';
import { File } from '@/modules/file/file.entity';

export class RevisionWithClientDTO extends OmitType(Revision, ['client']) {
  @ApiProperty({ type: () => PublicClient, required: false })
  client?: PublicClient;

  @ApiProperty({ type: () => File, required: false })
  files?: File[];
}
