/*
  Warnings:

  - A unique constraint covering the columns `[anno,numero,suffisso]` on the table `OrdineTrasferimento` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "OrdineTrasferimento_anno_numero_key";

-- AlterTable
ALTER TABLE "OrdineTrasferimento" ADD COLUMN     "suffisso" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "OrdineTrasferimento_anno_numero_suffisso_key" ON "OrdineTrasferimento"("anno", "numero", "suffisso");
