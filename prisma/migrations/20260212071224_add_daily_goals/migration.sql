-- CreateTable
CREATE TABLE "daily_goals" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL DEFAULT '',
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
