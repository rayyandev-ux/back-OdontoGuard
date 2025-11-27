-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nombres" TEXT,
    "apellidos" TEXT,
    "sexo" TEXT DEFAULT 'M',
    "dni" TEXT,
    "fechaNacimiento" TEXT,
    "edad" TEXT,
    "lugarNacimiento" TEXT,
    "lugarProcedencia" TEXT,
    "raza" TEXT,
    "domicilio" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "estadoCivil" TEXT,
    "gradoInstruccion" TEXT,
    "profesion" TEXT,
    "ocupacion" TEXT,
    "centroEstudios" TEXT,
    "direccionCentroEstudios" TEXT,
    "religion" TEXT,
    "medicoTratante" TEXT,
    "antecedentes" TEXT,
    "odontogram_initial" JSONB,
    "progress_records" JSONB,
    "treatments" JSONB,
    "general_attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
