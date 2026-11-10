export type CalendarTime = {
  minutes: number;
  timezone: string;
  offsetMinutes: number;
};

const TIMEZONE_OFFSETS: Record<string, Omit<CalendarTime, "minutes">> = {
  WIB: { timezone: "Asia/Jakarta", offsetMinutes: 7 * 60 },
  WITA: { timezone: "Asia/Makassar", offsetMinutes: 8 * 60 },
  WIT: { timezone: "Asia/Jayapura", offsetMinutes: 9 * 60 },
};

const TIME_RANGE_PATTERN =
  /^(\d{2})[.:](\d{2})\s*(am|pm)?\s*(?:-|–|—|s\.?\s*d\.?|sampai|hingga|to)\s*(\d{2})[.:](\d{2})\s*(am|pm)?\s*(WIB|WITA|WIT)$/i;

const ALL_DAY_PATTERN =
  /^(?:(?:agenda|kegiatan)\s+)?(?:sehari penuh|seharian(?: penuh)?|sepanjang hari|full day|all day)$/i;

function normalizeSchedule(schedule: string) {
  return schedule.trim().replace(/\s+/g, " ");
}

export function isAllDaySchedule(schedule: string) {
  return !normalizeSchedule(schedule) || ALL_DAY_PATTERN.test(normalizeSchedule(schedule));
}

function toMinutes(hoursValue: string, minutesValue?: string, meridiemValue?: string) {
  let hours = Number(hoursValue);
  const minutes = Number(minutesValue ?? 0);
  const meridiem = meridiemValue?.toLowerCase();

  if (
    minutes > 59 ||
    hours > 23 ||
    (meridiem && (hours < 1 || hours > 12))
  ) {
    return null;
  }

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function parseCalendarTimes(schedule: string): { start: CalendarTime; end: CalendarTime } | null {
  const normalizedSchedule = normalizeSchedule(schedule);
  if (!normalizedSchedule || isAllDaySchedule(normalizedSchedule)) return null;

  const match = normalizedSchedule.match(TIME_RANGE_PATTERN);
  if (!match) return null;

  const startMinutes = toMinutes(match[1], match[2], match[3]);
  if (startMinutes === null) return null;

  const endMinutes = toMinutes(match[4], match[5], match[6]);
  if (endMinutes === null) return null;
  if (endMinutes === startMinutes) return null;

  const timezoneKey = match[7].toUpperCase();
  const timezone = TIMEZONE_OFFSETS[timezoneKey];

  return {
    start: { minutes: startMinutes, ...timezone },
    end: { minutes: endMinutes, ...timezone },
  };
}

export function getScheduleValidationMessage(schedule: string) {
  if (isAllDaySchedule(schedule) || parseCalendarTimes(schedule)) return null;

  return [
    "Gunakan rentang lengkap seperti “09.00–12.00 WIB” atau “13:15–16:45 WITA”.",
    "Jam mulai dan selesai harus mencantumkan menit, serta zona WIB, WITA, atau WIT.",
    "Untuk acara lintas tengah malam, tulis jam selesai lebih kecil, misalnya “22:00–01:30 WIB”.",
    "Untuk agenda sehari penuh, kosongkan kolom atau tulis “Sehari penuh”.",
  ].join(" ");
}