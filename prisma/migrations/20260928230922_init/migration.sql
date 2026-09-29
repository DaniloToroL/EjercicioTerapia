-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'COACH', 'ATHLETE');

-- CreateEnum
CREATE TYPE "LoadType" AS ENUM ('EXTERNAL', 'BODYWEIGHT', 'BAND', 'TIME', 'DISTANCE', 'CONTACTS');

-- CreateEnum
CREATE TYPE "MovementPattern" AS ENUM ('SQUAT', 'HINGE', 'LUNGE', 'HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'CORE', 'CARRY', 'LOCOMOTION', 'PLYOMETRIC', 'MOBILITY', 'ISOLATION', 'CONDITIONING', 'OTHER');

-- CreateEnum
CREATE TYPE "MesocycleGoal" AS ENUM ('INTRODUCTORY', 'HYPERTROPHY', 'STRENGTH', 'POWER', 'DELOAD', 'REHAB', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('NONE', 'YOUTUBE', 'UPLOAD', 'EXTERNAL');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wellnessThresholds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "bodyWeightKg" DOUBLE PRECISION,
    "birthDate" DATE,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inviteToken" TEXT,
    "inviteExpires" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3),
    "coachId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'custom',
    "sourceId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "videoProvider" "VideoProvider" NOT NULL DEFAULT 'NONE',
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "pattern" "MovementPattern" NOT NULL DEFAULT 'OTHER',
    "loadType" "LoadType" NOT NULL DEFAULT 'EXTERNAL',
    "equipment" TEXT[],
    "bodyPart" TEXT,
    "targetMuscle" TEXT,
    "secondaryMuscles" TEXT[],
    "instructions" TEXT,
    "defaultBlockKey" TEXT,
    "unilateral" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockType" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BlockType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesocycle" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "goal" "MesocycleGoal" NOT NULL DEFAULT 'CUSTOM',
    "notes" TEXT,

    CONSTRAINT "Mesocycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Microcycle" (
    "id" TEXT NOT NULL,
    "mesocycleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,

    CONSTRAINT "Microcycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "microcycleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "notes" TEXT,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBlock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "blockTypeId" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "SessionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "group" TEXT,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "repsText" TEXT,
    "repsMin" INTEGER,
    "repsMax" INTEGER,
    "loadKg" DOUBLE PRECISION,
    "loadPct" DOUBLE PRECISION,
    "rpeTarget" DOUBLE PRECISION,
    "tempo" TEXT,
    "restSec" INTEGER,
    "notes" TEXT,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sessionRpe" DOUBLE PRECISION,
    "durationMin" INTEGER,
    "comment" TEXT,

    CONSTRAINT "WorkoutLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "workoutLogId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER,
    "loadKg" DOUBLE PRECISION,
    "seconds" INTEGER,
    "rpe" DOUBLE PRECISION,
    "done" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessCheckin" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "sessionId" TEXT,
    "date" DATE NOT NULL,
    "sleepTime" INTEGER NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "rest" INTEGER NOT NULL,
    "pain" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL,
    "nutrition" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");

-- CreateIndex
CREATE INDEX "User_orgId_role_idx" ON "User"("orgId", "role");

-- CreateIndex
CREATE INDEX "Exercise_orgId_archived_idx" ON "Exercise"("orgId", "archived");

-- CreateIndex
CREATE INDEX "Exercise_priority_name_idx" ON "Exercise"("priority", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_source_sourceId_key" ON "Exercise"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockType_orgId_key_key" ON "BlockType"("orgId", "key");

-- CreateIndex
CREATE INDEX "Program_orgId_isTemplate_idx" ON "Program"("orgId", "isTemplate");

-- CreateIndex
CREATE INDEX "Program_athleteId_active_idx" ON "Program"("athleteId", "active");

-- CreateIndex
CREATE INDEX "Mesocycle_programId_order_idx" ON "Mesocycle"("programId", "order");

-- CreateIndex
CREATE INDEX "Microcycle_mesocycleId_order_idx" ON "Microcycle"("mesocycleId", "order");

-- CreateIndex
CREATE INDEX "TrainingSession_microcycleId_order_idx" ON "TrainingSession"("microcycleId", "order");

-- CreateIndex
CREATE INDEX "SessionBlock_sessionId_order_idx" ON "SessionBlock"("sessionId", "order");

-- CreateIndex
CREATE INDEX "Prescription_blockId_order_idx" ON "Prescription"("blockId", "order");

-- CreateIndex
CREATE INDEX "Prescription_exerciseId_idx" ON "Prescription"("exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutLog_athleteId_date_idx" ON "WorkoutLog"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutLog_sessionId_athleteId_key" ON "WorkoutLog"("sessionId", "athleteId");

-- CreateIndex
CREATE INDEX "SetLog_prescriptionId_idx" ON "SetLog"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_workoutLogId_prescriptionId_setNumber_key" ON "SetLog"("workoutLogId", "prescriptionId", "setNumber");

-- CreateIndex
CREATE INDEX "WellnessCheckin_athleteId_date_idx" ON "WellnessCheckin"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessCheckin_athleteId_sessionId_key" ON "WellnessCheckin"("athleteId", "sessionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockType" ADD CONSTRAINT "BlockType_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesocycle" ADD CONSTRAINT "Mesocycle_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Microcycle" ADD CONSTRAINT "Microcycle_mesocycleId_fkey" FOREIGN KEY ("mesocycleId") REFERENCES "Mesocycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_microcycleId_fkey" FOREIGN KEY ("microcycleId") REFERENCES "Microcycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBlock" ADD CONSTRAINT "SessionBlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBlock" ADD CONSTRAINT "SessionBlock_blockTypeId_fkey" FOREIGN KEY ("blockTypeId") REFERENCES "BlockType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "SessionBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "WorkoutLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessCheckin" ADD CONSTRAINT "WellnessCheckin_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessCheckin" ADD CONSTRAINT "WellnessCheckin_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
