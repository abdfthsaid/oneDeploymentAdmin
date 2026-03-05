import { NextRequest, NextResponse } from 'next/server';
import { updateStationStats } from '@/lib/stationStatsJob';
import { cacheComponent } from '@/lib/cacheComponent';

// Secret to protect the cron endpoint
const CRON_SECRET = process.env.CRON_SECRET || process.env.JWT_SECRET || '';

export async function GET(req: NextRequest) {
  // Allow calls from internal scheduler (no auth) or with cron secret
  const authHeader = req.headers.get('authorization');
  const urlSecret = req.nextUrl.searchParams.get('secret');

  const isInternal = req.headers.get('x-internal-cron') === 'true';
  const hasValidSecret = (authHeader === `Bearer ${CRON_SECRET}`) || (urlSecret === CRON_SECRET);

  if (!isInternal && !hasValidSecret && CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('⏱️ Cron: Updating station stats...');
    const result = await updateStationStats();
    cacheComponent.invalidatePrefix('stations:stats:');
    return NextResponse.json({ 
      message: 'Station stats updated',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('❌ Cron station stats error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
