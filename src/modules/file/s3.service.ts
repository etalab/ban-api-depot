import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  GetObjectCommandOutput,
  PutObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { ObjectId } from 'bson';

@Injectable()
export class S3Service {
  s3Client: S3Client;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('S3_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.configService.get<string>('S3_SECRET_KEY'),
      },
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
    });
  }

  private async readStream(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private async getS3File(fileId): Promise<Buffer> {
    const { Body }: GetObjectCommandOutput = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.configService.get<string>('S3_CONTAINER_ID'),
        Key: fileId,
      }),
    );

    return this.readStream(Body as Readable);
  }

  private async uploadS3File(
    fileId: string,
    data: Buffer,
  ): Promise<PutObjectCommandOutput> {
    return this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.configService.get<string>('S3_CONTAINER_ID'),
        Key: fileId,
        Body: data,
      }),
    );
  }

  public async writeFile(buffer: Buffer): Promise<string> {
    try {
      const fileId = new ObjectId().toHexString();
      await this.uploadS3File(fileId, buffer);
      return fileId;
    } catch (error) {
      throw new HttpException(
        `Fichier non uploadé sur S3`,
        HttpStatus.SERVICE_UNAVAILABLE,
        {
          description: error.message,
        },
      );
    }
  }

  public async getFile(fileId: string): Promise<Buffer> {
    try {
      const file = await this.getS3File(fileId);
      return file;
    } catch (error) {
      throw new HttpException(
        'Fichier non trouvé sur S3',
        HttpStatus.NOT_FOUND,
        {
          description: error.message,
        },
      );
    }
  }
}
