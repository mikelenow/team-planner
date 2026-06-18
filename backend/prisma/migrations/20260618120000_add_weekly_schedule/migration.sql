-- CreateTable
CREATE TABLE "WeeklySchedule" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "hoursMonday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursTuesday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursWednesday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursThursday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursFriday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklySchedule_personId_weekStart_idx" ON "WeeklySchedule"("personId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySchedule_personId_weekStart_key" ON "WeeklySchedule"("personId", "weekStart");

-- AddForeignKey
ALTER TABLE "WeeklySchedule" ADD CONSTRAINT "WeeklySchedule_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
