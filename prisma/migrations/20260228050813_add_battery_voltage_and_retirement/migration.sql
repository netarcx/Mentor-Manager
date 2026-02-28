-- AlterTable
ALTER TABLE "battery_logs" ADD COLUMN "voltage" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_batteries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_batteries" ("active", "created_at", "id", "label", "sort_order") SELECT "active", "created_at", "id", "label", "sort_order" FROM "batteries";
DROP TABLE "batteries";
ALTER TABLE "new_batteries" RENAME TO "batteries";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
