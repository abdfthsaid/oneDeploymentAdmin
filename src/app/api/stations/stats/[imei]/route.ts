import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/auth';
import { cacheComponent, buildPrivateCacheControl } from '@/lib/cacheComponent';

const CACHE_TTL_MS = 30_000;

export async function GET(req: NextRequest, { params }: { params: { imei: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { imei } = params;
    const result = await cacheComponent.remember(
      `stations:stats:imei:${imei}`,
      CACHE_TTL_MS,
      async () => {
        const doc = await db.collection('station_stats').doc(imei).get();

        if (!doc.exists) {
          return {
            status: 404,
            body: { error: `No stats found for station ${imei}` },
          };
        }

        return {
          status: 200,
          body: { station: doc.data() },
        };
      },
    );

    return NextResponse.json(result.body, {
      status: result.status,
      headers: {
        'Cache-Control': buildPrivateCacheControl(CACHE_TTL_MS),
      },
    });
  } catch (err: any) {
    console.error(`Get Station Stats Error:`, err.message);
    return NextResponse.json({ error: 'Failed to fetch station stats' }, { status: 500 });
  }
}
