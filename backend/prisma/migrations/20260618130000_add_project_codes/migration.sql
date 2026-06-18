-- CreateTable
CREATE TABLE "ProjectCode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCode_code_key" ON "ProjectCode"("code");

-- CreateIndex
CREATE INDEX "ProjectCode_projectId_idx" ON "ProjectCode"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectCode" ADD CONSTRAINT "ProjectCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
