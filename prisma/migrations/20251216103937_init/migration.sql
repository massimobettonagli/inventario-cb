-- CreateTable
CREATE TABLE "Prodotto" (
    "id" TEXT NOT NULL,
    "codice" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prodotto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Magazzino" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Magazzino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giacenza" (
    "id" TEXT NOT NULL,
    "prodottoId" TEXT NOT NULL,
    "magazzinoId" TEXT NOT NULL,
    "qtyUltimoInventario" INTEGER NOT NULL DEFAULT 0,
    "qtyAttuale" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giacenza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImmagineProdotto" (
    "id" TEXT NOT NULL,
    "prodottoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImmagineProdotto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prodotto_codice_key" ON "Prodotto"("codice");

-- CreateIndex
CREATE UNIQUE INDEX "Magazzino_nome_key" ON "Magazzino"("nome");

-- CreateIndex
CREATE INDEX "Giacenza_magazzinoId_idx" ON "Giacenza"("magazzinoId");

-- CreateIndex
CREATE UNIQUE INDEX "Giacenza_prodottoId_magazzinoId_key" ON "Giacenza"("prodottoId", "magazzinoId");

-- CreateIndex
CREATE INDEX "ImmagineProdotto_prodottoId_idx" ON "ImmagineProdotto"("prodottoId");

-- AddForeignKey
ALTER TABLE "Giacenza" ADD CONSTRAINT "Giacenza_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Giacenza" ADD CONSTRAINT "Giacenza_magazzinoId_fkey" FOREIGN KEY ("magazzinoId") REFERENCES "Magazzino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImmagineProdotto" ADD CONSTRAINT "ImmagineProdotto_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
