import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  OmitType,
} from '@nestjs/swagger';
import { Response } from 'express';

import { AdminGuard } from '@/lib/class/guards/admin.guard';
import { CustomRequest } from '@/lib/types/request.type';
import { ClientService } from './client.service';
import { UpdateClientDTO } from './dto/update_client.dto';
import { ConfigService } from '@nestjs/config';
import { CreateClientDTO } from './dto/create_client.dto';
import { Client } from './client.entity';

@ApiTags('clients')
@Controller('clients')
export class ClientController {
  constructor(
    private clientService: ClientService,
    private configService: ConfigService,
  ) {}

  isAdmin(req: CustomRequest): boolean {
    const ADMIN_TOKEN: string = this.configService.get('ADMIN_TOKEN');
    return (
      req.get('Authorization') === `Token ${ADMIN_TOKEN}` ||
      req.get('Authorization') === `Bearer ${ADMIN_TOKEN}`
    );
  }

  @Get('')
  @ApiOperation({
    summary: 'Find all clients',
    operationId: 'findMany',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OmitType(Client, ['token']),
    isArray: true,
  })
  async findMany(@Res() res: Response) {
    const clients: Client[] = await this.clientService.findMany({});
    const clientsSafe: Omit<Client, 'token'>[] = clients.map((c) =>
      this.clientService.filterSensitiveFields(c),
    );
    res.status(HttpStatus.OK).json(clientsSafe);
  }

  @Post('')
  @ApiOperation({
    summary: 'create one client',
    operationId: 'createOne',
  })
  @ApiBody({ type: CreateClientDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: OmitType(Client, ['token']) })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async createOne(@Body() body: CreateClientDTO, @Res() res: Response) {
    const client: Client = await this.clientService.createOne(body);
    res.status(HttpStatus.OK).json(client);
  }

  @Get(':clientId')
  @ApiOperation({
    summary: 'Find one client',
    operationId: 'findOne',
  })
  @ApiParam({ name: 'clientId', required: true, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Client,
  })
  @ApiBearerAuth('admin-token')
  async findOne(@Req() req: CustomRequest, @Res() res: Response) {
    if (this.isAdmin(req)) {
      return res.status(HttpStatus.OK).json(req.client);
    }
    const clientSafe: Omit<Client, 'token'> =
      this.clientService.filterSensitiveFields(req.client);
    res.status(HttpStatus.OK).json(clientSafe);
  }

  @Put(':clientId')
  @ApiOperation({
    summary: 'update one client',
    operationId: 'updateOne',
  })
  @ApiParam({ name: 'clientId', required: true, type: String })
  @ApiBody({ type: UpdateClientDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: OmitType(Client, ['token']) })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async updateOne(
    @Req() req: CustomRequest,
    @Body() body: UpdateClientDTO,
    @Res() res: Response,
  ) {
    const client: Client = await this.clientService.updateOne(
      req.client.id,
      body,
    );
    const clientSafe: Omit<Client, 'token'> =
      this.clientService.filterSensitiveFields(client);
    res.status(HttpStatus.OK).json(clientSafe);
  }
}
