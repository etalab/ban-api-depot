import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';

import { CustomRequest } from '@/lib/types/request.type';
import { ParseDatePipe } from '@/lib/class/pipes/date.pipe';
import { FileService } from '@/modules/file/file.service';
import { Revision, StatusRevisionEnum } from './revision.entity';
import { RevisionService } from './revision.service';
import { RevisionWithClientDTO } from './dto/revision_with_client.dto';

@ApiTags('revisions')
@Controller('')
export class RevisionController {
  constructor(
    private revisionService: RevisionService,
    private fileService: FileService,
  ) {}

  @Get('current-revisions')
  @ApiOperation({
    summary: 'Find current revision by Commune',
    operationId: 'findCurrent',
  })
  @ApiQuery({ name: 'publishedSince', required: false, type: Date })
  @ApiResponse({ status: HttpStatus.OK, type: RevisionWithClientDTO })
  async findCurrents(
    @Query('publishedSince', ParseDatePipe)
    publishedSince: Date,
    @Res() res: Response,
  ) {
    const revisions: Revision[] =
      await this.revisionService.findCurrents(publishedSince);
    const revisionsWithClients: RevisionWithClientDTO[] =
      await this.revisionService.expandsWithClients(revisions);
    res.status(HttpStatus.OK).json(revisionsWithClients);
  }

  @Get('communes/:codeCommune/current-revision')
  @ApiOperation({
    summary: 'Find current revision by Commune',
    operationId: 'findCommuneCurrent',
  })
  @ApiParam({ name: 'codeCommune', required: true, type: String })
  @ApiResponse({ status: HttpStatus.OK, type: RevisionWithClientDTO })
  async findCurrent(@Req() req: CustomRequest, @Res() res: Response) {
    const revision: Revision = await this.revisionService.findCurrent(
      req.params.codeCommune,
    );

    const currentRevision: RevisionWithClientDTO =
      await this.revisionService.expandWithClientAndFile(revision);
    res.status(HttpStatus.OK).json(currentRevision);
  }

  @Get('communes/:codeCommune/revisions')
  @ApiOperation({
    summary: 'Find revisions by Commune',
    operationId: 'findByCommune',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter revisions by status, default to published revisions',
    examples: {
      published: {
        value: 'published',
        summary: 'Published revisions',
      },
      all: {
        value: 'all',
        summary: 'All revisions',
      },
      pending: {
        value: 'pending',
        summary: 'Pending revisions',
      },
    },
  })
  @ApiParam({ name: 'codeCommune', required: true, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    type: RevisionWithClientDTO,
    isArray: true,
  })
  async findByCommune(
    @Req() req: CustomRequest,
    @Res() res: Response,
    @Query('status') status: StatusRevisionEnum | 'all',
  ) {
    let statusQuery: { status?: StatusRevisionEnum } = {
      status: StatusRevisionEnum.PUBLISHED,
    };
    if (status === 'all') {
      statusQuery = {};
    } else if (status) {
      statusQuery = { status };
    }
    const revisions: Revision[] = await this.revisionService.findMany({
      codeCommune: req.params.codeCommune,
      ...statusQuery,
    });
    const revisionsWithClients: RevisionWithClientDTO[] =
      await this.revisionService.expandsWithClients(revisions);
    res.status(HttpStatus.OK).json(revisionsWithClients);
  }

  @Get('communes/:codeCommune/current-revision/files/bal/download')
  @ApiOperation({
    summary: 'Download file current revision by Commune',
    operationId: 'DownloadFileCurrent',
  })
  @ApiParam({ name: 'codeCommune', required: true, type: String })
  async downloadFileCurrent(@Req() req: CustomRequest, @Res() res: Response) {
    const revision: Revision = await this.revisionService.findCurrent(
      req.params.codeCommune,
    );
    const data: Buffer = await this.fileService.findDataByRevision(revision.id);

    res.attachment(`bal-${revision.codeCommune}.csv`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(data);
  }

  @Get('revisions/:revisionId')
  @ApiOperation({
    summary: 'Find one revision',
    operationId: 'findOne',
  })
  @ApiParam({ name: 'revisionId', required: true, type: String })
  @ApiResponse({ status: HttpStatus.OK, type: RevisionWithClientDTO })
  async findOne(@Req() req: CustomRequest, @Res() res: Response) {
    const revisionWithClient: RevisionWithClientDTO =
      await this.revisionService.expandWithClientAndFile(req.revision);
    res.status(HttpStatus.OK).json(revisionWithClient);
  }

  @Get('revisions/:revisionId/files/bal/download')
  @ApiParam({ name: 'revisionId', required: true, type: String })
  @ApiOperation({
    summary: 'Download file current revision by Commune',
    operationId: 'DownloadFileCurrent',
  })
  async downloadFile(@Req() req: CustomRequest, @Res() res: Response) {
    if (req.revision.status !== StatusRevisionEnum.PUBLISHED) {
      throw new HttpException(
        'La révision n’est pas encore accessible car non publiée',
        HttpStatus.FORBIDDEN,
      );
    }
    const data: Buffer = await this.fileService.findDataByRevision(
      req.revision.id,
    );

    res.attachment(`bal-${req.revision.codeCommune}.csv`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(data);
  }
}
