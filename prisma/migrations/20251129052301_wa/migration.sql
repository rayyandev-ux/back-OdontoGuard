-- CreateTable
CREATE TABLE "ControlSchedule" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "hour" INTEGER NOT NULL DEFAULT 10,
    "nextAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlSchedule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ControlSchedule" ADD CONSTRAINT "ControlSchedule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSchedule" ADD CONSTRAINT "ControlSchedule_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSchedule" ADD CONSTRAINT "ControlSchedule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
