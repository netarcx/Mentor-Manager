-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_mentors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar_path" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_mentors" ("created_at", "email", "id", "name") SELECT "created_at", "email", "id", "name" FROM "mentors";
DROP TABLE "mentors";
ALTER TABLE "new_mentors" RENAME TO "mentors";
CREATE UNIQUE INDEX "mentors_email_key" ON "mentors"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
