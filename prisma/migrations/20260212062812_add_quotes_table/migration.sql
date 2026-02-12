-- CreateTable
CREATE TABLE "hour_adjustments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mentor_id" INTEGER NOT NULL,
    "hours" REAL NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hour_adjustments_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "mentors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
