-- AlterTable
ALTER TABLE "shift_templates" ADD COLUMN "max_signups" INTEGER;

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN "max_signups" INTEGER;
