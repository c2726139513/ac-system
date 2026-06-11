-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('SPECIAL', 'NORMAL', 'ELECTRONIC', 'OTHER');

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseContract" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "contractNo" VARCHAR(100) NOT NULL,
    "contractName" VARCHAR(200) NOT NULL,
    "supplierName" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "signedDate" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesContract" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "contractNo" VARCHAR(100) NOT NULL,
    "contractName" VARCHAR(200) NOT NULL,
    "customerName" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "signedDate" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "purchaseContractId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "description" TEXT,
    "ofdFilePath" VARCHAR(500),
    "ofdOriginalName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "salesContractId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "description" TEXT,
    "ofdFilePath" VARCHAR(500),
    "ofdOriginalName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" UUID NOT NULL,
    "purchaseContractId" UUID NOT NULL,
    "invoiceNo" VARCHAR(50) NOT NULL,
    "invoiceCode" VARCHAR(50),
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "sellerName" VARCHAR(200),
    "buyerName" VARCHAR(200),
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'SPECIAL',
    "description" TEXT,
    "ofdFilePath" VARCHAR(500),
    "ofdOriginalName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" UUID NOT NULL,
    "salesContractId" UUID NOT NULL,
    "invoiceNo" VARCHAR(50) NOT NULL,
    "invoiceCode" VARCHAR(50),
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "sellerName" VARCHAR(200),
    "buyerName" VARCHAR(200),
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'SPECIAL',
    "description" TEXT,
    "ofdFilePath" VARCHAR(500),
    "ofdOriginalName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseContract_projectId_contractNo_key" ON "PurchaseContract"("projectId", "contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesContract_projectId_contractNo_key" ON "SalesContract"("projectId", "contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_invoiceNo_invoiceCode_key" ON "PurchaseInvoice"("invoiceNo", "invoiceCode");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_invoiceNo_invoiceCode_key" ON "SalesInvoice"("invoiceNo", "invoiceCode");

-- AddForeignKey
ALTER TABLE "PurchaseContract" ADD CONSTRAINT "PurchaseContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesContract" ADD CONSTRAINT "SalesContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseContractId_fkey" FOREIGN KEY ("purchaseContractId") REFERENCES "PurchaseContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_salesContractId_fkey" FOREIGN KEY ("salesContractId") REFERENCES "SalesContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_purchaseContractId_fkey" FOREIGN KEY ("purchaseContractId") REFERENCES "PurchaseContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_salesContractId_fkey" FOREIGN KEY ("salesContractId") REFERENCES "SalesContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
