-- Superadmin de plataforma y centros suspendibles.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperadmin" BOOLEAN NOT NULL DEFAULT false;
