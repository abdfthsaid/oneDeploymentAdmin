import { admin } from './firebase-admin';
import db from './firebase-admin';
import axios from 'axios';
import { cacheComponent } from './cacheComponent';

const MACHINE_CAPACITY = 8;
const STATIONS = [
  'WSEP161721195358',
  'WSEP161741066504',
  'WSEP161741066505',
  'WSEP161741066502',
  'WSEP161741066503',
];

const stationCache: Record<string, any> = {};

export async function updateStationStats() {
  const HEYCHARGE_API_KEY = process.env.HEYCHARGE_API_KEY;
  const HEYCHARGE_DOMAIN = process.env.HEYCHARGE_DOMAIN;

  if (!HEYCHARGE_API_KEY || !HEYCHARGE_DOMAIN) {
    console.log('⚠️ HeyCharge credentials not configured, skipping station stats update');
    return { success: false, message: 'HeyCharge credentials not configured' };
  }

  const now = admin.firestore.Timestamp.now();
  let successCount = 0;
  let failureCount = 0;

  for (const imei of STATIONS) {
    try {
      // 1. Fetch live station data from HeyCharge
      const url = `${HEYCHARGE_DOMAIN}/v1/station/${imei}`;
      const { data } = await axios.get(url, {
        auth: { username: HEYCHARGE_API_KEY, password: '' },
        timeout: 5000,
      });

      const rawBatteries = data.batteries || [];
      const station_status = data.station_status === 'Offline' ? 'Offline' : 'Online';

      // 2. Load station metadata
      const doc = await db.collection('stations').doc(imei).get();
      const meta = doc.exists ? doc.data() || {} : {};

      stationCache[imei] = {
        ...stationCache[imei],
        iccid: meta.iccid || stationCache[imei]?.iccid || '',
      };

      // 3. If offline, write offline snapshot
      if (station_status === 'Offline') {
        console.log(`⚠️ Station ${imei} is offline`);
        await db.collection('station_stats').doc(imei).set({
          id: imei, stationCode: imei, imei,
          name: meta.name || '', location: meta.location || '', iccid: meta.iccid || '',
          station_status, totalSlots: 0, availableCount: 0, rentedCount: 0, overdueCount: 0,
          timestamp: now, batteries: [], message: '❌ Station offline',
        });
        continue;
      }

      // 4. Prepare lookup of present batteries
      const presentIds = new Set(rawBatteries.map((b: any) => b.battery_id));

      // 5. Build initial slot map with empty entries
      const slotMap = new Map<string, any>();
      for (let slot = 1; slot <= MACHINE_CAPACITY; slot++) {
        const id = String(slot);
        slotMap.set(id, {
          slot_id: id, battery_id: null, level: null, status: 'Empty',
          rented: false, phoneNumber: '', rentedAt: null, amount: 0,
        });
      }

      // 6. Overlay HeyCharge data (live batteries)
      rawBatteries.forEach((b: any) => {
        if (!b.slot_id || typeof b.slot_id !== 'string') return;
        slotMap.set(b.slot_id, {
          slot_id: b.slot_id, battery_id: b.battery_id,
          level: parseInt(b.battery_capacity) || null,
          status: b.lock_status === '1' ? 'Online' : 'Offline',
          rented: false, phoneNumber: '', rentedAt: null, amount: 0,
        });
      });

      // 7. Fetch ongoing rentals
      const rentalsSnap = await db.collection('rentals')
        .where('imei', '==', imei)
        .where('status', '==', 'rented')
        .get();

      let rentedCount = 0;
      let overdueCount = 0;
      const nowDate = now.toDate();

      // 8. Close duplicate battery rentals — keep only latest
      const validRentals: { doc: any; data: any }[] = [];

      for (const rentalDoc of rentalsSnap.docs) {
        const r = rentalDoc.data();
        const { battery_id } = r;

        const duplicateSnap = await db.collection('rentals')
          .where('battery_id', '==', battery_id)
          .where('status', '==', 'rented')
          .orderBy('timestamp', 'desc')
          .get();

        if (duplicateSnap.docs.length > 1) {
          const [latest, ...old] = duplicateSnap.docs;
          for (const oldDoc of old) {
            await oldDoc.ref.update({
              status: 'returned', returnedAt: now,
              note: 'Auto-closed: duplicate battery rental',
            });
            console.log(`🛑 Closed duplicate rental for battery ${battery_id}`);
          }
          if (rentalDoc.id !== latest.id) continue;
        }

        // Auto-return if battery is physically present
        if (presentIds.has(battery_id)) {
          await rentalDoc.ref.update({
            status: 'returned', returnedAt: now,
            note: 'Auto-returned: battery physically present',
          });
          console.log(`↩️ Auto-returned ${battery_id}`);
          continue;
        }

        validRentals.push({ doc: rentalDoc, data: r });
      }

      // 9. Assign each valid rental to first available virtual slot
      for (const { data: r } of validRentals) {
        const { battery_id, amount, timestamp, phoneNumber } = r;

        let assignedSlot: string | null = null;
        for (let slot = 1; slot <= MACHINE_CAPACITY; slot++) {
          const slotId = String(slot);
          const slotData = slotMap.get(slotId);
          if (slotData.status === 'Empty' && !slotData.rented && !slotData.battery_id) {
            assignedSlot = slotId;
            break;
          }
        }

        if (!assignedSlot) continue;
        if (!timestamp || !amount) continue;

        const diffMs = nowDate.getTime() - timestamp.toDate().getTime();
        const diffH = diffMs / 3600000;
        let isOverdue = false;
        if (amount === 0.5 && diffH > 2) isOverdue = true;
        else if (amount === 1 && diffH > 12) isOverdue = true;

        slotMap.set(assignedSlot, {
          slot_id: assignedSlot, battery_id, level: null, status: 'Rented',
          rented: true, phoneNumber: phoneNumber || '', rentedAt: timestamp, amount: amount || 0,
        });

        rentedCount++;
        if (isOverdue) overdueCount++;
      }

      // 10. Finalize slots and counts
      const slots = Array.from(slotMap.values()).sort(
        (a, b) => parseInt(a.slot_id) - parseInt(b.slot_id)
      );
      const totalSlots = slots.length;
      const availableCount = slots.filter((s) => s.status === 'Online').length;

      // 11. Write consolidated stats
      await db.collection('station_stats').doc(imei).set({
        id: imei, stationCode: imei, imei,
        name: meta.name || '', location: meta.location || '', iccid: meta.iccid || '',
        station_status, totalSlots, availableCount, rentedCount, overdueCount,
        timestamp: now, batteries: slots,
      });

      console.log(`✅ Updated ${imei}: total=${totalSlots} avail=${availableCount} rented=${rentedCount} overdue=${overdueCount}`);
      successCount++;
    } catch (err: any) {
      failureCount++;
      console.error(`❌ Error for station ${imei}:`, err.message);

      try {
        const errMeta = stationCache[imei] || {};
        await db.collection('station_stats').doc(imei).set({
          id: imei, stationCode: imei, imei,
          name: errMeta.name || '', location: errMeta.location || '', iccid: errMeta.iccid || '',
          station_status: 'Offline', totalSlots: 0, availableCount: 0, rentedCount: 0, overdueCount: 0,
          timestamp: admin.firestore.Timestamp.now(), batteries: [],
          message: `❌ Error: ${err.message}`, lastError: err.message,
          lastErrorTime: admin.firestore.Timestamp.now(),
        });
      } catch (dbErr: any) {
        console.error(`❌ Failed to write error state for ${imei}:`, dbErr.message);
      }
    }
  }

  cacheComponent.invalidatePrefix('stations:stats:');
  cacheComponent.invalidatePrefix('revenue:');
  cacheComponent.invalidatePrefix('customers:');
  cacheComponent.invalidatePrefix('charts:');
  cacheComponent.invalidate('transactions:latest');
  cacheComponent.invalidatePrefix('dashboard:summary:');
  console.log(`📊 Station stats update complete: ${successCount} succeeded, ${failureCount} failed out of ${STATIONS.length} total`);

  return { success: true, successCount, failureCount, total: STATIONS.length };
}
