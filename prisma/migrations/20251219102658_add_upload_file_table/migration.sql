-- CreateTable
CREATE TABLE "UploadFile" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaderEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadFile_createdAt_idx" ON "UploadFile"("createdAt");
