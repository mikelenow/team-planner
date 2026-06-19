-- CreateTable
CREATE TABLE "JiraCache" (
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "JiraCache_type_idx" ON "JiraCache"("type");
