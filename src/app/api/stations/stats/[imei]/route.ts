import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/auth';
import {
  dedupeActiveRentalsByBattery,
  getRentalTimestampMillis,
} from '@/lib/activeRentals';
import { updateSingleStation } from '@/lib/stationStatsJob';

const OVERDUE_HOURS = 5;

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

  const { winners } = dedupeActiveRentalsByBattery(rentals);

  let rentedCount = 0;
  let overdueCount = 0;
  const now = Date.now();

  for (const rental of winners.sort((a, b) => {
    return (
      getRentalTimestampMillis(b.timestamp) -
      getRentalTimestampMillis(a.timestamp)
    );
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

    const rentedAtMs = getRentalTimestampMillis(rental.timestamp);
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
        .where('status', '==', 'rented')
        .get();

      const { winners } = dedupeActiveRentalsByBattery(
        rentalsSnap.docs.map((rentalDoc) => ({
          id: rentalDoc.id,
          ...rentalDoc.data(),
        })),
      );

      const station = buildLiveStationView(
        doc.data(),
        winners.filter((rental: any) => rental.imei === imei),
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
