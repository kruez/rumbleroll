-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('LOBBY', 'NUMBERS_ASSIGNED', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "venmoHandle" TEXT,
    "cashAppHandle" TEXT,
    "profileImageUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RumbleEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "status" "EventStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RumbleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "status" "PartyStatus" NOT NULL DEFAULT 'LOBBY',
    "entryFee" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hostId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyParticipant" (
    "id" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PartyParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberAssignment" (
    "id" TEXT NOT NULL,
    "entryNumber" INTEGER NOT NULL,
    "participantId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,

    CONSTRAINT "NumberAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RumbleEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" INTEGER NOT NULL,
    "wrestlerName" TEXT,
    "wrestlerImageUrl" TEXT,
    "enteredAt" TIMESTAMP(3),
    "eliminatedAt" TIMESTAMP(3),
    "eliminatedBy" TEXT,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "RumbleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wrestler" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "brand" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "aliases" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wrestler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeCacheMetadata" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lastScrapedAt" TIMESTAMP(3) NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "ScrapeCacheMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Party_inviteCode_key" ON "Party"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "PartyParticipant_partyId_userId_key" ON "PartyParticipant"("partyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NumberAssignment_partyId_entryNumber_key" ON "NumberAssignment"("partyId", "entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RumbleEntry_eventId_entryNumber_key" ON "RumbleEntry"("eventId", "entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Wrestler_slug_key" ON "Wrestler"("slug");

-- CreateIndex
CREATE INDEX "Wrestler_name_idx" ON "Wrestler"("name");

-- CreateIndex
CREATE INDEX "Wrestler_brand_idx" ON "Wrestler"("brand");

-- CreateIndex
CREATE INDEX "Wrestler_isActive_idx" ON "Wrestler"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeCacheMetadata_source_key" ON "ScrapeCacheMetadata"("source");

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RumbleEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyParticipant" ADD CONSTRAINT "PartyParticipant_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyParticipant" ADD CONSTRAINT "PartyParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberAssignment" ADD CONSTRAINT "NumberAssignment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "PartyParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberAssignment" ADD CONSTRAINT "NumberAssignment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RumbleEntry" ADD CONSTRAINT "RumbleEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RumbleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

