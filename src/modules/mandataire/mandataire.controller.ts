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
} from '@nestjs/swagger';
import { Response } from 'express';

import { CustomRequest } from '@/lib/types/request.type';
import { AdminGuard } from '@/lib/class/guards/admin.guard';
import { UpdateMandataireDTO } from './dto/update_mandataire.dto';
import { MandataireService } from './mandataire.service';
import { CreateMandataireDTO } from './dto/create_mandataire.dto';
import { Mandataire } from './mandataire.entity';

@ApiTags('mandataires')
@Controller('mandataires')
export class MandataireController {
  constructor(private mandataireService: MandataireService) {}

  @Get('')
  @ApiOperation({
    summary: 'Find all mandataires',
    operationId: 'findMany',
  })
  @ApiResponse({ status: HttpStatus.OK, type: Mandataire, isArray: true })
  async findMany(@Res() res: Response) {
    const mandataires: Mandataire[] = await this.mandataireService.findMany({});
    res.status(HttpStatus.OK).json(mandataires);
  }

  @Post('')
  @ApiOperation({
    summary: 'create one mandataire',
    operationId: 'createOne',
  })
  @ApiBody({ type: CreateMandataireDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Mandataire })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async createOne(@Body() body: CreateMandataireDTO, @Res() res: Response) {
    const mandataire: Mandataire = await this.mandataireService.createOne(body);
    res.status(HttpStatus.OK).json(mandataire);
  }

  @Get(':mandataireId')
  @ApiOperation({
    summary: 'Find one mandataire',
    operationId: 'findOne',
  })
  @ApiParam({ name: 'mandataireId', required: true, type: String })
  @ApiResponse({ status: HttpStatus.OK, type: Mandataire })
  async findOne(@Req() req: CustomRequest, @Res() res: Response) {
    res.status(HttpStatus.OK).json(req.mandataire);
  }

  @Put(':mandataireId')
  @ApiOperation({
    summary: 'update one mandataire',
    operationId: 'updateOne',
  })
  @ApiParam({ name: 'mandataireId', required: true, type: String })
  @ApiBody({ type: UpdateMandataireDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Mandataire })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async updateOne(
    @Req() req: CustomRequest,
    @Body() body: UpdateMandataireDTO,
    @Res() res: Response,
  ) {
    const mandataire: Mandataire = await this.mandataireService.updateOne(
      req.mandataire.id,
      body,
    );
    res.status(HttpStatus.OK).json(mandataire);
  }
}
