import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokenFields1699999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE refresh_tokens
        ADD COLUMN IF NOT EXISTS email citext,
        ADD COLUMN IF NOT EXISTS user_agent text,
        ADD COLUMN IF NOT EXISTS ip_addr inet;`
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_email ON refresh_tokens(email)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_email`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_expires_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_token_hash`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_user_id`);
    await queryRunner.query(
      `ALTER TABLE refresh_tokens
         DROP COLUMN IF EXISTS email,
         DROP COLUMN IF EXISTS user_agent,
         DROP COLUMN IF EXISTS ip_addr;`
    );
  }
}
