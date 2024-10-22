import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as randomNumber from 'random-number-csprng';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { UserFranceConnect } from '@/lib/types/user_france_connect.type';
import { getElu } from '@/lib/utils/elus';
import { getCommune } from '@/lib/utils/cog';
import { CommuneCOG } from '@/lib/types/cog.type';
import { ApiAnnuaireService } from '@/modules/api_annuaire/api_annuaire.service';
import { ValidateCodePinRequestDTO } from './dto/validate_code_pin.dto';
import {
  Habilitation,
  StatusHabilitationEnum,
  TypeStrategyEnum,
} from './habilitation.entity';
import { ClientService } from '../client/client.service';
import { HabilitationWithClientDTO } from './dto/habilitation_with_client.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { Elu } from '@/lib/types/elu.type';
import { Client } from '../client/client.entity';

@Injectable()
export class HabilitationService {
  constructor(
    @InjectRepository(Habilitation)
    private habilitationRepository: Repository<Habilitation>,
    private apiAnnuaireService: ApiAnnuaireService,
    private clientService: ClientService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  public async findOneOrFail(habilitationId: string): Promise<Habilitation> {
    const where: FindOptionsWhere<Habilitation> = {
      id: habilitationId,
    };
    const habilitation = await this.habilitationRepository.findOne({
      where,
      withDeleted: true,
    });

    if (!habilitation) {
      throw new HttpException(
        `Habilitation ${habilitationId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return habilitation;
  }

  public async findOne(
    where: FindOptionsWhere<Habilitation>,
  ): Promise<Habilitation> {
    return this.habilitationRepository.findOne({
      where,
    });
  }

  public async expandWithClient(
    habilitation: Habilitation,
  ): Promise<HabilitationWithClientDTO> {
    return {
      ...habilitation,
      client: await this.clientService.findPublicClient(habilitation.clientId),
    };
  }

  public async createOne(
    codeCommune: string,
    client: Client,
  ): Promise<Habilitation> {
    const habilitationId = new ObjectId().toHexString();

    const emailCommune =
      await this.apiAnnuaireService.getEmailCommune(codeCommune);

    const entityToSave: Habilitation = this.habilitationRepository.create({
      id: habilitationId,
      codeCommune,
      emailCommune,
      franceconnectAuthenticationUrl: `${this.configService.get<string>('API_DEPOT_URL')}/habilitations/${habilitationId}/authentication/franceconnect`,
      strategy: null,
      clientId: client.id,
      status: StatusHabilitationEnum.PENDING,
      expiresAt: null,
    });
    return this.habilitationRepository.save(entityToSave);
  }

  public async acceptHabilitation(
    habilitationId: string,
    changes: Partial<Habilitation> = {},
  ): Promise<Habilitation> {
    const now = new Date();
    const habilitationEnd = new Date();
    habilitationEnd.setMonth(habilitationEnd.getMonth() + 12);

    const entityToSave: Habilitation = this.habilitationRepository.create({
      id: habilitationId,
      ...changes,
      status: StatusHabilitationEnum.ACCEPTED,
      acceptedAt: now,
      expiresAt: habilitationEnd,
    });
    return this.habilitationRepository.save(entityToSave);
  }

  public async rejectHabilitation(
    habilitationId: string,
    changes: Partial<Habilitation>,
  ): Promise<Habilitation> {
    const now = new Date();
    const habilitationEnd = new Date();
    habilitationEnd.setMonth(habilitationEnd.getMonth() + 12);

    const entityToSave: Habilitation = this.habilitationRepository.create({
      id: habilitationId,
      ...changes,
      status: StatusHabilitationEnum.REJECTED,
      rejectedAt: now,
    });
    return this.habilitationRepository.save(entityToSave);
  }

  private hasBeenSentRecently(sentAt: Date) {
    const now = new Date();
    const floodLimitTime = new Date(sentAt);
    floodLimitTime.setMinutes(floodLimitTime.getMinutes() + 5);
    return now < floodLimitTime;
  }

  private async generatePinCode() {
    const number = await randomNumber(0, 999_999);
    return number.toString().padStart(6, '0');
  }

  private getExpirationDate(startDate: Date) {
    const expireAt = new Date(startDate);
    expireAt.setHours(expireAt.getHours() + 24);
    return expireAt;
  }

  public async sendCodePin(body: Habilitation): Promise<Habilitation> {
    if (body.status === StatusHabilitationEnum.ACCEPTED) {
      throw new HttpException(
        'Cette habilitation est déjà validée',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    if (body.status === StatusHabilitationEnum.REJECTED) {
      throw new HttpException(
        'Cette habilitation est rejetée',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    if (!body.emailCommune) {
      throw new HttpException(
        'Impossible d’envoyer le code, aucun courriel n’est connu pour cette commune',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    if (body.strategy && this.hasBeenSentRecently(body.strategy.createdAt)) {
      throw new HttpException(
        'Un courriel a déjà été envoyé, merci de patienter',
        HttpStatus.CONFLICT,
      );
    }

    const now = new Date();
    const pinCode = await this.generatePinCode();

    const entityToSave: Habilitation = this.habilitationRepository.create({
      strategy: {
        type: TypeStrategyEnum.EMAIL,
        pinCode,
        pinCodeExpiration: this.getExpirationDate(now),
        remainingAttempts: 10,
        createdAt: now,
      },
    });

    const habilitation: Habilitation =
      await this.habilitationRepository.save(entityToSave);

    const { nom }: CommuneCOG = getCommune(habilitation.codeCommune);

    if (habilitation.emailCommune) {
      await this.mailerService.sendMail({
        to: habilitation.emailCommune,
        subject: 'Demande de code d’identification',
        template: 'code-pin',
        bcc: this.configService.get('SMTP_BCC'),
        context: {
          apiUrl: this.configService.get('API_DEPOT_URL'),
          pinCode,
          nomCommune: nom,
        },
      });
    }

    return habilitation;
  }

  public async validateCodePin(
    habilitation: Habilitation,
    { code }: ValidateCodePinRequestDTO,
  ) {
    if (habilitation.status === StatusHabilitationEnum.ACCEPTED) {
      throw new HttpException(
        'Cette habilitation est déjà validée',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    if (habilitation.status === StatusHabilitationEnum.REJECTED) {
      throw new HttpException(
        'Cette habilitation est rejetée',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    if (this.configService.get<string>('DEMO_MODE') && code === '000000') {
      await this.acceptHabilitation(habilitation.id);
      return;
    }

    if (code !== habilitation.strategy.pinCode) {
      const strategy = habilitation.strategy;
      strategy.remainingAttempts -= 1;

      this.habilitationRepository.update({ id: habilitation.id }, { strategy });

      if (strategy.remainingAttempts <= 0) {
        this.habilitationRepository.update(
          { id: habilitation.id },
          { status: StatusHabilitationEnum.REJECTED, rejectedAt: new Date() },
        );

        throw new HttpException(
          'Code non valide. Demande rejetée.',
          HttpStatus.PRECONDITION_FAILED,
        );
      }

      const plural = strategy.remainingAttempts > 1 ? 's' : '';

      throw new HttpException(
        `Code non valide, ${strategy.remainingAttempts} tentative${plural} restante${plural}`,
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    const now = new Date();
    if (now > habilitation.strategy.pinCodeExpiration) {
      throw new HttpException('Code expiré', HttpStatus.PRECONDITION_FAILED);
    }

    await this.acceptHabilitation(habilitation.id);
  }

  public async franceConnectCallback(
    user: UserFranceConnect,
    habilitationId: string,
  ): Promise<void> {
    const habilitation = await this.findOneOrFail(habilitationId);

    if (habilitation.status === StatusHabilitationEnum.PENDING) {
      const elu: Elu = getElu(user);

      const haveMandat: boolean = elu?.codeCommune.includes(
        habilitation.codeCommune,
      );

      if (haveMandat) {
        await this.acceptHabilitation(habilitation.id, {
          strategy: {
            type: TypeStrategyEnum.FRANCECONNECT,
            mandat: {
              prenom: user.given_name,
              nomNaissance: user.family_name,
              nomMarital: user.preferred_username,
            },
          },
        });
      } else {
        await this.rejectHabilitation(habilitation.id, {
          strategy: {
            type: TypeStrategyEnum.FRANCECONNECT,
            authenticationError:
              'Aucun mandat valide trouvé pour cette commune',
          },
        });
      }
    }
  }
}
