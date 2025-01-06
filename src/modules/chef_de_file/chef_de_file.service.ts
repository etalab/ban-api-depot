import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { FindOptionsSelect, FindOptionsWhere, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ChefDeFile } from './chef_de_file.entity';

@Injectable()
export class ChefDeFileService {
  constructor(
    @InjectRepository(ChefDeFile)
    private chefsDeFileRepository: Repository<ChefDeFile>,
  ) {}

  async findMany(
    where: FindOptionsWhere<ChefDeFile>,
    select?: FindOptionsSelect<ChefDeFile>,
  ): Promise<ChefDeFile[]> {
    return this.chefsDeFileRepository.find({
      where,
      ...(select && { select }),
    });
  }

  public async findOneOrFail(chefDeFileId: string): Promise<ChefDeFile> {
    const where: FindOptionsWhere<ChefDeFile> = {
      id: chefDeFileId,
    };
    const chefDeFile = await this.chefsDeFileRepository.findOne({
      where,
      withDeleted: true,
    });

    if (!chefDeFile) {
      throw new HttpException(
        `Chef de file ${chefDeFileId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return chefDeFile;
  }

  public async createOne(payload: Partial<ChefDeFile>): Promise<ChefDeFile> {
    const entityToSave: ChefDeFile = this.chefsDeFileRepository.create({
      perimeters: [],
      ...payload,
    });
    return this.chefsDeFileRepository.save(entityToSave);
  }

  public async updateOne(
    chefDeFileId: string,
    changes: Partial<ChefDeFile>,
  ): Promise<ChefDeFile> {
    const entityToSave: ChefDeFile = this.chefsDeFileRepository.create({
      id: chefDeFileId,
      ...changes,
    });
    await this.chefsDeFileRepository.save(entityToSave);
    return this.chefsDeFileRepository.findOneBy({ id: chefDeFileId });
  }
}
