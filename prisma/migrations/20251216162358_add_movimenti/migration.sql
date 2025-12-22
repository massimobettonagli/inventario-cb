-- CreateTable
CREATE TABLE "MovimentoMagazzino" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prodottoId" TEXT NOT NULL,
    "magazzinoId" TEXT NOT NULL,
    "codice" TEXT NOT NULL,
    "qtyPrima" INTEGER NOT NULL,
    "qtyDopo" INTEGER NOT NULL,

    CONSTRAINT "MovimentoMagazzino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimentoMagazzino_createdAt_idx" ON "MovimentoMagazzino"("createdAt");

-- CreateIndex
CREATE INDEX "MovimentoMagazzino_magazzinoId_createdAt_idx" ON "MovimentoMagazzino"("magazzinoId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimentoMagazzino_codice_createdAt_idx" ON "MovimentoMagazzino"("codice", "createdAt");

-- AddForeignKey
ALTER TABLE "MovimentoMagazzino" ADD CONSTRAINT "MovimentoMagazzino_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoMagazzino" ADD CONSTRAINT "MovimentoMagazzino_magazzinoId_fkey" FOREIGN KEY ("magazzinoId") REFERENCES "Magazzino"("id") ON DELETE CASCADE ON UPDATE CASCADE;
