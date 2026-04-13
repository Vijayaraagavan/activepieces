import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemovePlatformOwnerUniqueConstraint1776023700000 implements MigrationInterface {
    name = 'RemovePlatformOwnerUniqueConstraint1776023700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "platform" DROP CONSTRAINT "REL_94d6fd6494f0322c6f0e099141"
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "platform" ADD CONSTRAINT "REL_94d6fd6494f0322c6f0e099141" UNIQUE ("ownerId")
        `)
    }
}
