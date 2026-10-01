-- El RPE pasa a registrarse una vez por ejercicio (ExerciseLog) en vez de por serie.

-- CreateTable
CREATE TABLE "ExerciseLog" (
    "id" TEXT NOT NULL,
    "workoutLogId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "rpe" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseLog_prescriptionId_idx" ON "ExerciseLog"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseLog_workoutLogId_prescriptionId_key" ON "ExerciseLog"("workoutLogId", "prescriptionId");

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "WorkoutLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Los RPE ya registrados por serie pasan al ejercicio: se toma el más alto (la serie más exigente).
INSERT INTO "ExerciseLog" ("id", "workoutLogId", "prescriptionId", "rpe", "updatedAt")
SELECT gen_random_uuid()::text, "workoutLogId", "prescriptionId", MAX("rpe"), NOW()
FROM "SetLog"
WHERE "rpe" IS NOT NULL
GROUP BY "workoutLogId", "prescriptionId";
