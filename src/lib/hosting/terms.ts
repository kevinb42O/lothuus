/** Calendar months keep the day where possible and clamp at month end. */
export function addCalendarMonths(start: Date, months: number) {
  if (
    !Number.isInteger(months) ||
    months < 1 ||
    months > 60 ||
    !Number.isFinite(start.getTime())
  )
    throw new Error("Ongeldige looptijd.");
  const end = new Date(start),
    day = end.getDate();
  end.setDate(1);
  end.setMonth(end.getMonth() + months);
  end.setDate(
    Math.min(day, new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()),
  );
  return end;
}
