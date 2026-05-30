-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadlineDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Advance" ADD COLUMN "assignmentId" TEXT,
ADD COLUMN "isSimulation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Assignment_advisorId_idx" ON "Assignment"("advisorId");

-- CreateIndex
CREATE INDEX "Advance_assignmentId_idx" ON "Advance"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_official_advance_per_assignment" ON "Advance" ("studentId", "assignmentId") WHERE "isSimulation" = false;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
