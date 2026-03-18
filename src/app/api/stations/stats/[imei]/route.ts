import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/auth';
import { updateSingleStation } from '@/lib/stationStatsJob';

const OVERDUE_HOURS = 5;

function getTimestampMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?._seconds === 'number') return value._seconds * 1000;
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function buildLiveStationView(station: any, rentals: any[]) {
  const sourceSlots = Array.isArray(station?.batteries) ? station.batteries : [];
  const slots = sourceSlots.map((slot: any) => {
    const normalizedStatus = String(slot?.status || '').toLowerCase();
    const isVirtualRentalSlot =
      normalizedStatus === 'rented' || normalizedStatus === 'overdue';

    if (!isVirtualRentalSlot) {
      return {
        ...slot,
        rented: false,
        phoneNumber: '',
        rentedAt: null,
        amount: 0,
      };
    }

    return {
      ...slot,
      battery_id: null,
      level: null,
      status: 'Empty',
      rented: false,
      phoneNumber: '',
      rentedAt: null,
      amount: 0,
    };
  });

  const latestByBattery = new Map<string, any>();
  for (const rental of rentals) {
    const batteryId = rental?.battery_id;
    if (!batteryId) continue;

    const currentTs = getTimestampMillis(rental.timestamp);
    const existing = latestByBattery.get(batteryId);
    if (!existing || currentTs > getTimestampMillis(existing.timestamp)) {
      latestByBattery.set(batteryId, rental);
    }
  }

  let rentedCount = 0;
  let overdueCount = 0;
  const now = Date.now();

  for (const rental of Array.from(latestByBattery.values()).sort((a, b) => {
    return getTimestampMillis(b.timestamp) - getTimestampMillis(a.timestamp);
  })) {
    const assignedSlotIndex = slots.findIndex((slot: any) => {
      return (
        String(slot?.status || '').toLowerCase() === 'empty' &&
        !slot?.rented &&
        !slot?.battery_id
      );
    });

    if (assignedSlotIndex === -1) {
      continue;
    }

    const rentedAtMs = getTimestampMillis(rental.timestamp);
    const isOverdue =
      rentedAtMs > 0 && now - rentedAtMs > OVERDUE_HOURS * 60 * 60 * 1000;

    slots[assignedSlotIndex] = {
      ...slots[assignedSlotIndex],
      battery_id: rental.battery_id,
      level: null,
      status: isOverdue ? 'Overdue' : 'Rented',
      rented: true,
      phoneNumber: rental.phoneNumber || '',
      rentedAt: rental.timestamp || null,
      amount: rental.amount || 0,
      rentalId: rental.id || null,
      unlockStatus: rental.unlockStatus || null,
    };

    rentedCount++;
    if (isOverdue) {
      overdueCount++;
    }
  }

  const availableCount = slots.filter((slot: any) => {
    return String(slot?.status || '').toLowerCase() === 'online';
  }).length;

  return {
    ...station,
    batteries: slots,
    totalSlots: slots.length,
    availableCount,
    rentedCount,
    overdueCount,
  };
}

export async function GET(req: NextRequest, { params }: { params: { imei: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { imei } = params;
    const fresh = req.nextUrl.searchParams.get('fresh') === '1';

    const loadStation = async () => {
      const doc = await db.collection('station_stats').doc(imei).get();

      if (!doc.exists) {
        return {
          status: 404,
          body: { error: `No stats found for station ${imei}` },
        };
      }

      const rentalsSnap = await db
        .collection('rentals')
        .where('imei', '==', imei)
        .where('status', '==', 'rented')
        .get();

      const station = buildLiveStationView(
        doc.data(),
        rentalsSnap.docs.map((rentalDoc) => ({
          id: rentalDoc.id,
          ...rentalDoc.data(),
        })),
      );

      return {
        status: 200,
        body: { station },
      };
    };

    if (fresh) {
      await updateSingleStation(imei);
    }

    const result = await loadStation();

    return NextResponse.json(result.body, {
      status: result.status,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error(`Get Station Stats Error:`, err.message);
    return NextResponse.json({ error: 'Failed to fetch station stats' }, { status: 500 });
  }
}
