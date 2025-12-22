-- CreateEnum
CREATE TYPE "StatoOrdineTrasferimento" AS ENUM ('DRAFT', 'INVIATA', 'IN_LAVORAZIONE', 'CHIUSA');

-- CreateTable
CREATE TABLE "OrdineTrasferimento" (
    "id" TEXT NOT NULL,
    "anno" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "codice" TEXT NOT NULL,
    "stato" "StatoOrdineTrasferimento" NOT NULL DEFAULT 'DRAFT',
    "daMagazzinoId" TEXT NOT NULL,
    "aMagazzinoId" TEXT NOT NULL,
    "emailDestinatario" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdineTrasferimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdineTrasferimentoRiga" (
    "id" TEXT NOT NULL,
    "ordineId" TEXT NOT NULL,
    "codiceProdotto" TEXT NOT NULL,
    "descrizioneSnap" TEXT,
    "qty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdineTrasferimentoRiga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdineTrasferimento_codice_key" ON "OrdineTrasferimento"("codice");

-- CreateIndex
CREATE INDEX "OrdineTrasferimento_stato_idx" ON "OrdineTrasferimento"("stato");

-- CreateIndex
CREATE INDEX "OrdineTrasferimento_daMagazzinoId_idx" ON "OrdineTrasferimento"("daMagazzinoId");

-- CreateIndex
CREATE INDEX "OrdineTrasferimento_aMagazzinoId_idx" ON "OrdineTrasferimento"("aMagazzinoId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdineTrasferimento_anno_numero_key" ON "OrdineTrasferimento"("anno", "numero");

-- CreateIndex
CREATE INDEX "OrdineTrasferimentoRiga_ordineId_idx" ON "OrdineTrasferimentoRiga"("ordineId");

-- CreateIndex
CREATE INDEX "OrdineTrasferimentoRiga_codiceProdotto_idx" ON "OrdineTrasferimentoRiga"("codiceProdotto");

-- AddForeignKey
ALTER TABLE "OrdineTrasferimento" ADD CONSTRAINT "OrdineTrasferimento_daMagazzinoId_fkey" FOREIGN KEY ("daMagazzinoId") REFERENCES "Magazzino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdineTrasferimento" ADD CONSTRAINT "OrdineTrasferimento_aMagazzinoId_fkey" FOREIGN KEY ("aMagazzinoId") REFERENCES "Magazzino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdineTrasferimentoRiga" ADD CONSTRAINT "OrdineTrasferimentoRiga_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "OrdineTrasferimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
