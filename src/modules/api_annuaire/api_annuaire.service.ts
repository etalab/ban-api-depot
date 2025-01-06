import { Injectable, Logger } from '@nestjs/common';
import { deburr } from 'lodash';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class ApiAnnuaireService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: Logger,
  ) {}

  private normalize(str: string) {
    return deburr(str).toLowerCase();
  }

  private validateEmail(email: string) {
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[(?:\d{1,3}\.){3}\d{1,3}])|(([a-zA-Z\-\d]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  public async getEmailCommune(codeCommune: string): Promise<string> {
    try {
      const url: string = `/catalog/datasets/api-lannuaire-administration/records?where=pivot%20LIKE%20"mairie"%20AND%20code_insee_commune="${codeCommune}"&limit=100`;
      const options: AxiosRequestConfig = { responseType: 'json' };
      const { data } = await firstValueFrom(
        this.httpService.get<any>(url, options).pipe(
          catchError((error: AxiosError) => {
            throw error;
          }),
        ),
      );
      const mairie =
        data.results.find(
          ({ nom }) => !this.normalize(nom).includes('deleguee'),
        ) || data.results[0];

      if (!mairie.adresse_courriel || mairie.adresse_courriel === '') {
        throw new Error('L’adresse email n’est pas trouvé');
      }

      const emails = mairie.adresse_courriel.split(';');
      const email = emails.shift();

      if (this.validateEmail(email)) {
        return email;
      }

      throw new Error(`L’adresse email " ${email} " ne peut pas être utilisée`);
    } catch (error) {
      this.logger.error(
        `Une erreur s’est produite lors de la récupération de l’adresse email de la mairie (Code commune: ${codeCommune}).`,
        ApiAnnuaireService.name,
        error,
      );
    }
  }
}
