import { FieldValue, Timestamp } from "firebase-admin/firestore";

import {
  ActiveRentalRow,
  compareRentalPriorityDesc,
  groupActiveRentalsByBattery,
} from "./activeRentals";
import { normalizeBatteryId } from "./batteryId";
import db from "./firebase-admin";

export const BATTERY_STATE_COLLECTION = "battery_state";

function batteryStateDocId(batteryId: string) {
  return normalizeBatteryId(batteryId) || batteryId;
}

function buildStatePayload(
  rental: ActiveRentalRow,
  claimedAt: any,
  updatedAt: Timestamp,
) {
  return {
    battery_id: batteryStateDocId(String(rental.battery_id || "")),
    imei: rental.imei || null,
    stationCode: rental.stationCode || null,
    slot_id: rental.slot_id || null,
    activeRentalId: rental.id || null,
    phoneNumber: rental.phoneNumber || "",
    requestedPhoneNumber: rental.requestedPhoneNumber || rental.phoneNumber || "",
    phoneAuthority: rental.phoneAuthority || null,
    transactionId: rental.transactionId || null,
    issuerTransactionId: rental.issuerTransactionId || null,
    referenceId: rental.referenceId || null,
    amount: rental.amount || 0,
    status: "rented",
    claimedAt,
    updatedAt,
    waafiAccountNo: rental.waafiAccountNo || null,
    waafiConfirmedPhoneNumber: rental.waafiConfirmedPhoneNumber || null,
  };
}

function shouldUpdateState(existing: any, rental: ActiveRentalRow) {
  return (
    String(existing?.activeRentalId || "") !== String(rental.id || "") ||
    String(existing?.phoneNumber || "") !== String(rental.phoneNumber || "") ||
    String(existing?.requestedPhoneNumber || "") !==
      String(rental.requestedPhoneNumber || rental.phoneNumber || "") ||
    String(existing?.imei || "") !== String(rental.imei || "") ||
    String(existing?.slot_id || "") !== String(rental.slot_id || "")
  );
}

export async function synchronizeBatteryStateFromActiveRentals(
  activeRentals: ActiveRentalRow[],
) {
  const grouped = groupActiveRentalsByBattery(activeRentals);
  const groupsByBattery = new Map(grouped.map((group) => [group.batteryId, group]));
  const existingStatesSnap = await db
    .collection(BATTERY_STATE_COLLECTION)
    .where("status", "==", "rented")
    .get();
  const existingStateByBattery = new Map<
    string,
    { ref: any; data: Record<string, any> }
  >();

  for (const doc of existingStatesSnap.docs) {
    const data = doc.data() as Record<string, any>;
    existingStateByBattery.set(
      batteryStateDocId(String(data.battery_id || doc.id)),
      { ref: doc.ref, data },
    );
  }

  const batch = db.batch();
  const now = Timestamp.now();
  let hasWrites = false;
  const officialRentals: ActiveRentalRow[] = [];

  for (const [batteryId, existing] of existingStateByBattery.entries()) {
    if (groupsByBattery.has(batteryId)) {
      continue;
    }

    batch.set(
      existing.ref,
      {
        battery_id: batteryId,
        status: "returned",
        updatedAt: now,
        lastReturnedAt: now,
        activeRentalId: FieldValue.delete(),
        imei: FieldValue.delete(),
        stationCode: FieldValue.delete(),
        slot_id: FieldValue.delete(),
        phoneNumber: FieldValue.delete(),
        requestedPhoneNumber: FieldValue.delete(),
        phoneAuthority: FieldValue.delete(),
        transactionId: FieldValue.delete(),
        issuerTransactionId: FieldValue.delete(),
        referenceId: FieldValue.delete(),
        amount: FieldValue.delete(),
        waafiAccountNo: FieldValue.delete(),
        waafiConfirmedPhoneNumber: FieldValue.delete(),
      },
      { merge: true },
    );
    hasWrites = true;
  }

  for (const group of grouped) {
    const existing = existingStateByBattery.get(group.batteryId);
    const rentalsById = new Map(
      group.rentals.map((rental) => [String(rental.id || ""), rental]),
    );
    const existingRentalId = String(existing?.data.activeRentalId || "");
    const officialRental =
      (existingRentalId && rentalsById.get(existingRentalId)) ||
      [...group.rentals].sort(compareRentalPriorityDesc)[0] ||
      group.primary;

    officialRentals.push(officialRental);

    if (!existing || shouldUpdateState(existing.data, officialRental)) {
      const claimedAt = existing?.data.claimedAt || officialRental.timestamp || now;
      const payload = buildStatePayload(officialRental, claimedAt, now);
      const ref =
        existing?.ref ||
        db.collection(BATTERY_STATE_COLLECTION).doc(group.batteryId);
      batch.set(ref, payload, { merge: true });
      hasWrites = true;
    }
  }

  if (hasWrites) {
    await batch.commit();
  }

  return officialRentals.sort(compareRentalPriorityDesc);
}

export async function clearBatteryStateIfCurrent({
  batteryId,
  rentalId,
  note,
  force = false,
}: {
  batteryId: string;
  rentalId: string;
  note?: string;
  force?: boolean;
}) {
  const normalizedBatteryId = batteryStateDocId(batteryId);
  const stateRef = db.collection(BATTERY_STATE_COLLECTION).doc(normalizedBatteryId);
  const now = Timestamp.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef);

    if (!snap.exists) {
      tx.set(
        stateRef,
        {
          battery_id: normalizedBatteryId,
          status: "returned",
          updatedAt: now,
          lastReturnedAt: now,
          lastReturnedRentalId: rentalId,
          ...(note ? { note } : {}),
        },
        { merge: true },
      );
      return;
    }

    const data = snap.data() || {};
    const activeRentalId = String(data.activeRentalId || "");

    if (!force && activeRentalId && activeRentalId !== rentalId) {
      return;
    }

    tx.set(
      stateRef,
      {
        battery_id: normalizedBatteryId,
        status: "returned",
        updatedAt: now,
        lastReturnedAt: now,
        lastReturnedRentalId: rentalId,
        ...(note ? { note } : {}),
        activeRentalId: FieldValue.delete(),
        imei: FieldValue.delete(),
        stationCode: FieldValue.delete(),
        slot_id: FieldValue.delete(),
        phoneNumber: FieldValue.delete(),
        requestedPhoneNumber: FieldValue.delete(),
        phoneAuthority: FieldValue.delete(),
        transactionId: FieldValue.delete(),
        issuerTransactionId: FieldValue.delete(),
        referenceId: FieldValue.delete(),
        amount: FieldValue.delete(),
        waafiAccountNo: FieldValue.delete(),
        waafiConfirmedPhoneNumber: FieldValue.delete(),
      },
      { merge: true },
    );
  });
}
