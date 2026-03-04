import { updateStationStats } from './stationStatsJob';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const INITIAL_DELAY_MS = 30 * 1000; // 30 seconds after first request

const globalForScheduler = globalThis as unknown as {
  _schedulerStarted: boolean;
};

export function startScheduler() {
  if (globalForScheduler._schedulerStarted) return;
  globalForScheduler._schedulerStarted = true;

  console.log('⏱️ Station stats scheduler: will start in 30 seconds, then every 10 minutes');

  setTimeout(() => {
    // First run
    console.log('⏱️ Running initial station stats update...');
    updateStationStats().catch((err) => {
      console.error('❌ Initial station stats update failed:', err.message);
    });

    // Then every 10 minutes
    setInterval(async () => {
      try {
        console.log('⏱️ Scheduled station stats update...');
        await updateStationStats();
      } catch (err: any) {
        console.error('❌ Scheduled station stats update failed:', err.message);
      }
    }, INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
