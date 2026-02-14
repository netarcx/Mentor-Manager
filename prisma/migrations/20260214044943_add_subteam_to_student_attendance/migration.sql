-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_student_attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "student_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "checked_in_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_out_at" DATETIME,
    "subteam" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "student_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_student_attendance" ("checked_in_at", "checked_out_at", "date", "id", "student_id") SELECT "checked_in_at", "checked_out_at", "date", "id", "student_id" FROM "student_attendance";
DROP TABLE "student_attendance";
ALTER TABLE "new_student_attendance" RENAME TO "student_attendance";
CREATE INDEX "student_attendance_date_idx" ON "student_attendance"("date");
CREATE INDEX "student_attendance_student_id_idx" ON "student_attendance"("student_id");
CREATE UNIQUE INDEX "student_attendance_student_id_date_key" ON "student_attendance"("student_id", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
