/*
  Warnings:

  - Added the required column `updatedAt` to the `OrdineTrasferimentoRiga` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrdineTrasferimento" ADD COLUMN "closedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrdineTrasferimentoRiga"
  ADD COLUMN "qtyPrepared" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- (opzionale ma consigliato) dopo il backfill, togli il default
ALTER TABLE "OrdineTrasferimentoRiga"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "OrdineTrasferimentoRiga_ordineId_codiceProdotto_idx"
  ON "OrdineTrasferimentoRiga"("ordineId", "codiceProdotto");