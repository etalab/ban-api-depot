import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { omit } from 'lodash';

import { generateToken } from '@/lib/utils/token.utils';
import { MandataireService } from '@/modules/mandataire/mandataire.service';
import { ChefDeFileService } from '@/modules/chef_de_file/chef_de_file.service';
import { PublicClient } from './dto/public_client.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { CreateClientDTO } from './dto/create_client.dto';
import { UpdateClientDTO } from './dto/update_client.dto';
import { ConfigService } from '@nestjs/config';
import { ChefDeFile } from '../chef_de_file/chef_de_file.entity';
import { Mandataire } from '../mandataire/mandataire.entity';
import { AuthorizationStrategyEnum, Client } from './client.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsSelect, FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    private mandataireService: MandataireService,
    private chefDeFileService: ChefDeFileService,
    private readonly configService: ConfigService,
    private mailerService: MailerService,
  ) {}

  async findMany(
    where: FindOptionsWhere<Client>,
    select?: FindOptionsSelect<Client>,
  ): Promise<Client[]> {
    return this.clientRepository.find({
      where,
      ...(select && { select }),
    });
  }

  public async findOne(where: FindOptionsWhere<Client>): Promise<Client> {
    return this.clientRepository.findOne({
      where,
    });
  }

  public async findOneOrFail(clientId: string): Promise<Client> {
    const where: FindOptionsWhere<Client> = {
      id: clientId,
    };
    const client = await this.clientRepository.findOne({
      where,
      withDeleted: true,
    });

    if (!client) {
      throw new HttpException(
        `Client ${clientId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return client;
  }

  public async createOne(body: CreateClientDTO): Promise<Client> {
    let chefDeFile: ChefDeFile;
    if (body.chefDeFileId) {
      chefDeFile = await this.chefDeFileService.findOneOrFail(
        body.chefDeFileId,
      );
    }

    const mandataire: Mandataire = await this.mandataireService.findOneOrFail(
      body.mandataireId,
    );

    const entityToSave: Client = this.clientRepository.create({
      ...body,
      token: generateToken(),
      authorizationStrategy: body.chefDeFileId
        ? AuthorizationStrategyEnum.CHEF_DE_FILE
        : AuthorizationStrategyEnum.HABILITATION,
    });
    const client = await this.clientRepository.save(entityToSave);

    await this.mailerService.sendMail({
      to: mandataire.email,
      subject: 'Accès à l’API dépôt d’une Base Adresse Locale',
      template: 'new-client',
      bcc: this.configService.get('SMTP_BCC'),
      context: {
        apiUrl: this.configService.get('API_DEPOT_URL'),
        client: client,
        mandataire,
        chefDeFile,
      },
    });

    return client;
  }

  public async updateOne(
    clientId: string,
    changes: UpdateClientDTO,
  ): Promise<Client> {
    if (changes.chefDeFileId) {
      await this.chefDeFileService.findOneOrFail(changes.chefDeFileId);
    }
    if (changes.mandataireId) {
      await this.mandataireService.findOneOrFail(changes.mandataireId);
    }

    await this.clientRepository.update({ id: clientId }, changes);
    return this.clientRepository.findOneBy({ id: clientId });
  }

  public filterSensitiveFields(client: Client): Omit<Client, 'token'> {
    return omit(client, 'token');
  }

  public async findAllPublicClients(): Promise<PublicClient[]> {
    const clients = await this.clientRepository.find({
      relations: ['mandataire', 'chefDeFile'],
    });

    return clients.map((client: Client) => ({
      id: client.id,
      legacyId: client.legacyId,
      nom: client.nom,
      mandataire: client.mandataire.nom,
      chefDeFile: client.chefDeFile?.nom,
      chefDeFileEmail: client.chefDeFile?.isEmailPublic
        ? client.chefDeFile?.email
        : null,
    }));
  }

  public async findPublicClient(clientId: string): Promise<PublicClient> {
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
      relations: ['mandataire', 'chefDeFile'],
    });

    if (!client) {
      throw new HttpException(
        `Client ${clientId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: client.id,
      legacyId: client.legacyId,
      nom: client.nom,
      mandataire: client.mandataire.nom,
      chefDeFile: client.chefDeFile?.nom || null,
      chefDeFileEmail: client.chefDeFile?.isEmailPublic
        ? client.chefDeFile?.email
        : null,
    };
  }
}
