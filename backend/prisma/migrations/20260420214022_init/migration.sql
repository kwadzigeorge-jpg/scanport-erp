-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Scanner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "acceleratorSerial" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL DEFAULT 'Siemens',
    "type" TEXT NOT NULL DEFAULT 'Fixed Scanner',
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scannerId" TEXT NOT NULL,
    "inspectionDate" DATETIME NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "noticeDate" DATETIME NOT NULL,
    "certificateStatus" TEXT NOT NULL DEFAULT 'ISSUED',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certification_scannerId_fkey" FOREIGN KEY ("scannerId") REFERENCES "Scanner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificationId" TEXT NOT NULL,
    "noticeStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
    "dateSent" DATETIME,
    "method" TEXT,
    "referenceNumber" TEXT,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertLog_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Scanner_serialNumber_key" ON "Scanner"("serialNumber");
