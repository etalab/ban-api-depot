import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { pick } from 'lodash';

import { isCommune } from '@/lib/utils/cog.utils';
import { PublicClient } from '@/modules/client/dto/public_client.dto';
import { ClientService } from '@/modules/client/client.service';
import { FileService } from '@/modules/file/file.service';
import { File } from '@/modules/file/file.entity';
import { BanService } from '@/modules/ban/ban.service';
import { HabilitationService } from '@/modules/habilitation/habilitation.service';
import { StatusHabilitationEnum } from '@/modules/habilitation/habilitation.entity';
import { RevisionWithClientDTO } from './dto/revision_with_client.dto';
import { ValidationService } from './validation.service';
import { NotifyService } from './notify.service';
import {
  Context,
  Revision,
  StatusRevisionEnum,
  Validation,
} from './revision.entity';
import { AuthorizationStrategyEnum, Client } from '../client/client.entity';
import {
  FindOptionsSelect,
  FindOptionsWhere,
  MoreThan,
  Not,
  Repository,
  UpdateResult,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RevisionAgg } from '../stats/stats.service';

@Injectable()
export class RevisionService {
  lockCommune: Record<string, boolean> = {};

  constructor(
    @InjectRepository(Revision)
    private revisionRepository: Repository<Revision>,
    private clientService: ClientService,
    private habilitationService: HabilitationService,
    private fileService: FileService,
    private validationService: ValidationService,
    private banService: BanService,
    private notifyService: NotifyService,
  ) {}

  async findMany(
    where: FindOptionsWhere<Revision>,
    select?: FindOptionsSelect<Revision>,
  ): Promise<Revision[]> {
    return this.revisionRepository.find({
      where,
      ...(select && { select }),
    });
  }

  public async findOneOrFail(revisionId: string): Promise<Revision> {
    const where: FindOptionsWhere<Revision> = {
      id: revisionId,
    };
    const revision = await this.revisionRepository.findOne({
      where,
      withDeleted: true,
    });

    if (!revision) {
      throw new HttpException(
        `Revision ${revisionId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return revision;
  }

  async findFirsts(): Promise<RevisionAgg[]> {
    const query = this.revisionRepository
      .createQueryBuilder('revisions')
      .select('DISTINCT ON (code_commune) code_commune', 'codeCommune')
      .addSelect('revisions.published_at', 'publishedAt')
      .addSelect('revisions.client_id', 'clientId')
      .orderBy('code_commune, published_at');

    return query.getRawMany();
  }

  public async findCurrents(publishedSince: Date | null = null) {
    const publishedSinceQuery = publishedSince
      ? { publishedAt: MoreThan(publishedSince) }
      : {};

    const revisions: Revision[] = await this.revisionRepository.find({
      where: { isCurrent: true, ...publishedSinceQuery },
      select: {
        id: true,
        codeCommune: true,
        publishedAt: true,
        clientId: true,
      },
    });

    return revisions.filter((r) => isCommune(r.codeCommune));
  }

  public async findCurrent(codeCommune: string): Promise<Revision> {
    const revision = await this.revisionRepository.findOne({
      where: { isCurrent: true, codeCommune },
    });

    if (!revision) {
      throw new HttpException(
        `Aucune revision trouvé pour la commune ${codeCommune}`,
        HttpStatus.NOT_FOUND,
      );
    }

    return revision;
  }

  public async createOne(
    codeCommune: string,
    client: Client,
    context: Context,
  ): Promise<Revision> {
    const entityToSave: Revision = this.revisionRepository.create({
      codeCommune,
      context,
      clientId: client.id,
      status: StatusRevisionEnum.PENDING,
      isReady: false,
      isCurrent: false,
      publishedAt: null,
    });
    return this.revisionRepository.save(entityToSave);
  }

  public async updateOne(
    revisionId: string,
    changes: Partial<Revision>,
  ): Promise<Revision> {
    await this.revisionRepository.update({ id: revisionId }, changes);
    return this.revisionRepository.findOneBy({ id: revisionId });
  }

  public async expandWithClientAndFile(
    revision: Revision,
  ): Promise<RevisionWithClientDTO> {
    return {
      ...revision,
      client: await this.clientService.findPublicClient(revision.clientId),
      files: [await this.fileService.findOneByRevision(revision.id)],
    };
  }

  public async expandsWithClients(
    revisions: Revision[],
  ): Promise<RevisionWithClientDTO[]> {
    const clients: PublicClient[] =
      await this.clientService.findAllPublicClients();
    return revisions.map((r: Revision) => ({
      ...r,
      client: clients.find(({ id }) => r.clientId === id),
    }));
  }

  public async setFile(revision: Revision, fileData: Buffer): Promise<File> {
    if (revision.status !== StatusRevisionEnum.PENDING) {
      throw new HttpException(
        'La révision n’est plus modifiable',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    const currentFile: File = await this.fileService.findOneByRevision(
      revision.id,
    );

    if (currentFile) {
      throw new HttpException(
        'Fichier déjà attaché a la révision',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    const file: File = await this.fileService.createOne(revision.id, fileData);

    return file;
  }

  public async computeOne(
    revision: Revision,
    client: Client,
  ): Promise<Revision> {
    if (revision.status !== StatusRevisionEnum.PENDING) {
      throw new HttpException(
        'La révision n’est plus modifiable',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    const fileData: Buffer = await this.fileService.findDataByRevision(
      revision.id,
    );

    const validation: Validation = await this.validationService.validate(
      fileData,
      revision.codeCommune,
      client,
    );

    return this.updateOne(revision.id, {
      validation,
      isReady: Boolean(validation.valid),
    });
  }

  public async publishOneWithLock(
    revision: Revision,
    client: Client,
    habilitationId: string | null = null,
  ): Promise<Revision> {
    const isLock = this.lockCommune[revision.codeCommune];
    if (isLock) {
      throw new HttpException(
        'La publication n’est pas possible car une publication est deja en cours',
        HttpStatus.PRECONDITION_FAILED,
      );
    }
    this.lockCommune[revision.codeCommune] = true;
    try {
      const res = await this.publishOne(revision, client, habilitationId);
      delete this.lockCommune[revision.codeCommune];
      return res;
    } catch (e) {
      delete this.lockCommune[revision.codeCommune];
      throw e;
    }
  }

  public async publishOne(
    revision: Revision,
    client: Client,
    habilitationId: string | null = null,
  ): Promise<Revision> {
    if (revision.status !== StatusRevisionEnum.PENDING || !revision.isReady) {
      throw new HttpException(
        'La publication n’est pas possible',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    const now = new Date();
    const changes: Partial<Revision> = {
      publishedAt: now,
      updatedAt: now,
      isReady: null,
      status: StatusRevisionEnum.PUBLISHED,
      isCurrent: true,
    };

    if (
      client.authorizationStrategy === AuthorizationStrategyEnum.HABILITATION
    ) {
      if (habilitationId) {
        const habilitation = await this.habilitationService.findOne({
          id: habilitationId,
          codeCommune: revision.codeCommune,
          clientId: client.id,
          status: StatusHabilitationEnum.ACCEPTED,
        });

        if (!habilitation) {
          throw new HttpException(
            `L’habilitation ${habilitationId} n’est pas valide`,
            HttpStatus.NOT_FOUND,
          );
        }

        changes.habilitation = pick(habilitation, [
          'id',
          'emailCommune',
          'codeCommune',
          'createdAt',
          'updatedAt',
          'expiresAt',
          'strategy',
        ]);
      } else {
        throw new HttpException(
          `Le client ${client.nom} nécessite une habilitation pour publier`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    let prevRevision = null;
    try {
      prevRevision = await this.findCurrent(revision.codeCommune);
    } catch {}

    // On supprime le flag current pour toutes les anciennes révisions publiées de cette commune
    const removeCurrentRes: UpdateResult = await this.revisionRepository.update(
      {
        codeCommune: revision.codeCommune,
        isCurrent: true,
      },
      { isCurrent: false },
    );

    // On publie la révision
    const revisionPublished = await this.updateOne(revision.id, changes);

    // On invalide toutes les révisions en attente pour cette commune
    await this.revisionRepository.update(
      {
        codeCommune: revision.codeCommune,
        status: StatusRevisionEnum.PENDING,
        id: Not(revision.id),
      },
      { isReady: false },
    );

    if (process.env.NOTIFY_BAN === '1') {
      this.banService.composeCommune(revision.codeCommune);
    }

    await this.notifyService.notifySlack(
      revision.codeCommune,
      removeCurrentRes.affected > 0,
      revisionPublished.habilitation?.strategy.type,
      client,
    );

    // On notifie les partenaires si une commune qui était gérée par un partenaire
    // force une publication via mes-adresses
    await this.notifyService.onForcePublish(prevRevision, revisionPublished);

    return revisionPublished;
  }
}
