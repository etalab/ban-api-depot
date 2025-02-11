import { MigrationInterface, QueryRunner } from 'typeorm';

export class HabilitationMultiMails1733836836713 implements MigrationInterface {
  name = 'HabilitationMultiMails1733836836713';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "habilitations" ADD "emails_commune" text array`,
    );
    await queryRunner.query(
      `UPDATE habilitations SET emails_commune = ARRAY[email_commune] WHERE email_commune IS NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE "habilitations" DROP COLUMN "email_commune"`,
    );
  }

  public async down(): Promise<void> {}
}
