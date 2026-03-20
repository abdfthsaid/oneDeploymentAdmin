export function getRentalTimestampMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getSortableRentalId(value: any): string {
  return String(value?.id || "");
}

export function compareRentalPriorityDesc(a: any, b: any): number {
  const timestampDiff =
    getRentalTimestampMillis(b?.timestamp) - getRentalTimestampMillis(a?.timestamp);

  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return getSortableRentalId(b).localeCompare(getSortableRentalId(a));
}

export function dedupeActiveRentalsByBattery<T extends { battery_id?: string }>(
  rentals: T[],
) {
  const latestByBattery = new Map<string, T>();
  const duplicates: T[] = [];

  for (const rental of [...rentals].sort(compareRentalPriorityDesc)) {
    const batteryId = String(rental?.battery_id || "");
    if (!batteryId) continue;

    if (!latestByBattery.has(batteryId)) {
      latestByBattery.set(batteryId, rental);
      continue;
    }

    duplicates.push(rental);
  }

  return {
    latestByBattery,
    winners: Array.from(latestByBattery.values()),
    duplicates,
  };
}
