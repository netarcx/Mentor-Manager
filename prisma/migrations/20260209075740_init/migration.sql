-- CreateTable
CREATE TABLE "mentors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "shift_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "template_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shifts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "shift_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "signups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mentor_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "signed_up_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signups_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "mentors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "signups_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "mentors_email_key" ON "mentors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_date_start_time_end_time_key" ON "shifts"("date", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "signups_mentor_id_shift_id_key" ON "signups"("mentor_id", "shift_id");
