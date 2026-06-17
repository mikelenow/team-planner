/*
  Warnings:

  - You are about to drop the column `isAdmin` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "jiraAccountId" TEXT,
ADD COLUMN     "jiraEmail" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "jiraProjectKey" TEXT,
ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isAdmin",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'VIEWER';

-- CreateTable
CREATE TABLE "TempoConfig" (
    "id" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.tempo.io/4',
    "apiToken" TEXT NOT NULL,
    "jiraBaseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TempoWorklog" (
    "id" TEXT NOT NULL,
    "tempoWorklogId" INTEGER NOT NULL,
    "jiraAccountId" TEXT NOT NULL,
    "jiraProjectKey" TEXT NOT NULL,
    "jiraIssueKey" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "timeSpentHours" DOUBLE PRECISION NOT NULL,
    "personId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempoWorklog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TempoWorklog_tempoWorklogId_key" ON "TempoWorklog"("tempoWorklogId");

-- CreateIndex
CREATE INDEX "TempoWorklog_jiraAccountId_date_idx" ON "TempoWorklog"("jiraAccountId", "date");

-- CreateIndex
CREATE INDEX "TempoWorklog_jiraProjectKey_date_idx" ON "TempoWorklog"("jiraProjectKey", "date");

-- CreateIndex
CREATE INDEX "TempoWorklog_personId_date_idx" ON "TempoWorklog"("personId", "date");

-- CreateIndex
CREATE INDEX "TempoWorklog_projectId_date_idx" ON "TempoWorklog"("projectId", "date");
