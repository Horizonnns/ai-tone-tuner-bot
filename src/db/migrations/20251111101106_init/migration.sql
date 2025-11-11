-- CreateTable
CREATE TABLE "OfferMessage" (
    "id" SERIAL NOT NULL,
    "telegramId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferMessage_pkey" PRIMARY KEY ("id")
);
