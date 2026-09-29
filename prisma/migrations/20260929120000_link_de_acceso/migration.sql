-- Link permanente por atleta, con modo de acceso (con login o abierto).

-- CreateEnum
CREATE TYPE "AccessMode" AS ENUM ('LOGIN', 'OPEN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessMode" "AccessMode" NOT NULL DEFAULT 'LOGIN',
ADD COLUMN     "accessToken" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_accessToken_key" ON "User"("accessToken");

-- Los atletas que ya existen reciben su link (aleatorio criptográfico, 64 caracteres).
UPDATE "User"
SET "accessToken" = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE "role" = 'ATHLETE' AND "accessToken" IS NULL;
