-- CreateIndex
CREATE INDEX "hour_adjustments_mentor_id_idx" ON "hour_adjustments"("mentor_id");

-- CreateIndex
CREATE INDEX "hour_adjustments_date_idx" ON "hour_adjustments"("date");

-- CreateIndex
CREATE INDEX "signups_shift_id_idx" ON "signups"("shift_id");

-- CreateIndex
CREATE INDEX "signups_mentor_id_idx" ON "signups"("mentor_id");
