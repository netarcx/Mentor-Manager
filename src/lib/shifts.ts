import { prisma } from "./db";
import { SHIFT_GENERATION_WEEKS } from "./constants";
import { todayISO } from "./utils";

export async function generateShiftsFromTemplates(
  weeksAhead: number = SHIFT_GENERATION_WEEKS
): Promise<number> {
  const templates = await prisma.shiftTemplate.findMany({
    where: { active: true },
  });

  if (templates.length === 0) return 0;

  let created = 0;
  // Use Central Time "today" so shift generation is correct near midnight
  const todayStr = todayISO();
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + weeksAhead * 7);

  for (const template of templates) {
    // Find the next occurrence of this day of week starting from today
    const current = new Date(today);
    const daysUntil = (template.dayOfWeek - current.getDay() + 7) % 7;
    current.setDate(current.getDate() + daysUntil);

    // If daysUntil is 0, we start from today (include today's shift if it hasn't passed)
    while (current < endDate) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

      try {
        await prisma.shift.create({
          data: {
            date: dateStr,
            startTime: template.startTime,
            endTime: template.endTime,
            label: template.label,
            templateId: template.id,
          },
        });
        created++;
      } catch {
        // Unique constraint violation = shift already exists, skip
      }

      current.setDate(current.getDate() + 7);
    }
  }

  return created;
}
