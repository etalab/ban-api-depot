import {
  Perimeter,
  TypePerimeterEnum,
} from '@/modules/chef_de_file/perimeters.entity';
import {
  getCommunesByDepartement,
  getCommune,
  getEPCI,
  isArrondissement,
} from './cog.utils';
import { CommuneCOG, EpciCOG } from '@/lib/types/cog.type';

function isInDepartement(departement: string, codeCommune: string): boolean {
  const communeByDepartement: CommuneCOG[] =
    getCommunesByDepartement(departement);
  return communeByDepartement.some(({ code }) => code === codeCommune);
}

function isInEPCI(siren: string, codeCommune: string): boolean {
  const epci: EpciCOG = getEPCI(siren);
  return epci?.membres?.some(({ code }) => code === codeCommune);
}

function codeInseeIsInPerimeters(codeInsee: string, perimeters: Perimeter[]) {
  return perimeters.some(({ type, code }) => {
    if (type === TypePerimeterEnum.COMMUNE && code === codeInsee) {
      return true;
    }

    if (
      type === TypePerimeterEnum.DEPARTEMENT &&
      isInDepartement(code, codeInsee)
    ) {
      return true;
    }

    if (type === TypePerimeterEnum.EPCI && isInEPCI(code, codeInsee)) {
      return true;
    }

    return false;
  });
}

export function communeIsInPerimeters(
  codeInsee: string,
  perimeters: Perimeter[],
) {
  const res = codeInseeIsInPerimeters(codeInsee, perimeters);
  if (isArrondissement(codeInsee)) {
    const codeCommune: string = getCommune(codeInsee).commune;
    const resArrondissement = codeInseeIsInPerimeters(codeCommune, perimeters);
    return res || resArrondissement;
  }
  return res;
}
