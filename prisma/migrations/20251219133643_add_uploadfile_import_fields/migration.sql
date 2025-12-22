/*
  Warnings:

  - You are about to drop the column `fileName` on the `ImportUpload` table. All the data in the column will be lost.
  - Added the required column `mimeType` to the `ImportUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `ImportUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `ImportUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storedName` to the `ImportUpload` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ImportUpload" DROP COLUMN "fileName",
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "storedName" TEXT NOT NULL,
ADD COLUMN     "uploaderEmail" TEXT;

-- CreateIndex
CREATE INDEX "ImportUpload_kind_idx" ON "ImportUpload"("kind");
