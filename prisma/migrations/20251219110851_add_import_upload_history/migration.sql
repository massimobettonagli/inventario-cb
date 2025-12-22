-- CreateTable
CREATE TABLE "ImportUpload" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "magazzinoId" TEXT,
    "magazzinoNome" TEXT,
    "rows" INTEGER,
    "createdProducts" INTEGER,
    "updatedProducts" INTEGER,
    "upsertedGiacenze" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportUpload_createdAt_idx" ON "ImportUpload"("createdAt");
