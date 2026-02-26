/*
  Warnings:

  - You are about to drop the column `shippedAt` on the `OrdineTrasferimentoRiga` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OrdineTrasferimento" ADD COLUMN     "shippedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrdineTrasferimentoRiga" DROP COLUMN "shippedAt";

-- CreateIndex
CREATE INDEX "OrdineTrasferimento_shippedAt_idx" ON "OrdineTrasferimento"("shippedAt");
