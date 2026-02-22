-- CreateTable
CREATE TABLE "batteries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "battery_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "battery_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "match_key" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "battery_logs_battery_id_fkey" FOREIGN KEY ("battery_id") REFERENCES "batteries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "battery_logs_battery_id_idx" ON "battery_logs"("battery_id");

-- CreateIndex
CREATE INDEX "battery_logs_created_at_idx" ON "battery_logs"("created_at");
