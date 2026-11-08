CREATE TYPE "PaymentStatus" AS ENUM (
    'NOT_STARTED',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'EXPIRED'
);

CREATE TYPE "StockReservationStatus" AS ENUM (
    'RESERVED',
    'CONSUMED',
    'RELEASED'
);

ALTER TABLE "Order"
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "stockReservationStatus" "StockReservationStatus" NOT NULL DEFAULT 'RELEASED',
ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "idempotencyScope" TEXT NOT NULL DEFAULT 'orders:create',
ADD COLUMN "idempotencyHash" TEXT,
ADD COLUMN "paymentSessionId" TEXT;

CREATE UNIQUE INDEX "Order_paymentSessionId_key" ON "Order"("paymentSessionId");

CREATE INDEX "Order_status_paymentStatus_stockReservationStatus_reservationExpiresAt_idx"
ON "Order"("status", "paymentStatus", "stockReservationStatus", "reservationExpiresAt");

CREATE UNIQUE INDEX "Order_userId_idempotencyScope_idempotencyKey_key"
ON "Order"("userId", "idempotencyScope", "idempotencyKey");
