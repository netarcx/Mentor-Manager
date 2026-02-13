-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_signups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mentor_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "custom_start_time" TEXT,
    "custom_end_time" TEXT,
    "signed_up_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" DATETIME,
    "virtual" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "signups_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "mentors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "signups_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_signups" ("checked_in_at", "custom_end_time", "custom_start_time", "id", "mentor_id", "note", "shift_id", "signed_up_at") SELECT "checked_in_at", "custom_end_time", "custom_start_time", "id", "mentor_id", "note", "shift_id", "signed_up_at" FROM "signups";
DROP TABLE "signups";
ALTER TABLE "new_signups" RENAME TO "signups";
CREATE INDEX "signups_shift_id_idx" ON "signups"("shift_id");
CREATE INDEX "signups_mentor_id_idx" ON "signups"("mentor_id");
CREATE UNIQUE INDEX "signups_mentor_id_shift_id_key" ON "signups"("mentor_id", "shift_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
