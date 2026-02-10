export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function shiftDurationHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return (endH * 60 + endM - (startH * 60 + startM)) / 60;
}

export function isShiftCurrent(shift: { date: string; startTime: string; endTime: string }): boolean {
  const now = getCentralTime();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (shift.date !== today) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = shift.startTime.split(":").map(Number);
  const [endH, endM] = shift.endTime.split(":").map(Number);

  return currentMinutes >= startH * 60 + startM && currentMinutes <= endH * 60 + endM;
}

// Get current date/time in Central Time Zone
function getCentralTime(): Date {
  // Create a date in Central Time by using toLocaleString
  const nowUTC = new Date();
  const centralTimeStr = nowUTC.toLocaleString("en-US", {
    timeZone: "America/Chicago",
  });
  return new Date(centralTimeStr);
}

export function todayISO(): string {
  const now = getCentralTime();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function currentTimeStr(): string {
  const now = getCentralTime();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function isWithinDays(dateStr: string, days: number): boolean {
  const today = todayISO();
  const [ty, tm, td] = today.split("-").map(Number);
  const [sy, sm, sd] = dateStr.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const shiftDate = new Date(sy, sm - 1, sd);
  const diffMs = shiftDate.getTime() - todayDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}
