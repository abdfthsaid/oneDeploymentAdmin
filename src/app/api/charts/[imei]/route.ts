import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";
import { applyRevenueCuts } from "@/lib/timeUtils";
import { cacheComponent, buildPrivateCacheControl } from "@/lib/cacheComponent";

const CACHE_TTL_MS = 60_000;

const imeiToStationCode: Record<string, string> = {
  WSEP161721195358: "58",
  WSEP161741066504: "04",
  WSEP161741066505: "05",
  WSEP161741066502: "02",
  WSEP161741066503: "03",
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekNumber(d: Date) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { imei: string } },
) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, [
    "user",
    "moderator",
    "admin",
  ]);
  if (roleCheck) return roleCheck;

  try {
    const { imei } = params;
    const stationCode = imeiToStationCode[imei];

    if (!stationCode) {
      return NextResponse.json({ error: "Invalid IMEI" }, { status: 400 });
    }

    const payload = await cacheComponent.remember(
      `charts:imei:${imei}`,
      CACHE_TTL_MS,
      async () => {
        const snapshot = await db
          .collection("rentals")
          .where("stationCode", "==", stationCode)
          .where("status", "in", ["rented", "returned"])
          .get();

        const dailyRev: Record<string, number> = {};
        const weeklyRev: Record<string, number> = {};
        const monthlyRev: Record<string, number> = {};
        const dailyCust: Record<string, Set<string>> = {};
        const weeklyCust: Record<string, Set<string>> = {};
        const monthlyCust: Record<string, Set<string>> = {};

        snapshot.forEach((doc: any) => {
          const r = doc.data();
          if (!r.timestamp) return;

          const ts = r.timestamp.toDate();
          const day = isoDate(ts);
          const week = `Week ${getWeekNumber(ts)}`;
          const month = ts.toLocaleString("default", {
            year: "numeric",
            month: "long",
          });

          const rawAmt = parseFloat(r.amount) || 0;
          const amt = rawAmt > 0 ? applyRevenueCuts(rawAmt) : 0;
          const phone = r.phoneNumber || "";

          dailyRev[day] = (dailyRev[day] || 0) + amt;
          weeklyRev[week] = (weeklyRev[week] || 0) + amt;
          monthlyRev[month] = (monthlyRev[month] || 0) + amt;

          dailyCust[day] = dailyCust[day] || new Set();
          weeklyCust[week] = weeklyCust[week] || new Set();
          monthlyCust[month] = monthlyCust[month] || new Set();

          dailyCust[day].add(phone);
          weeklyCust[week].add(phone);
          monthlyCust[month].add(phone);
        });

        const build = (
          rev: Record<string, number>,
          cust: Record<string, Set<string>>,
        ) => ({
          labels: Object.keys(rev).sort(),
          data: Object.keys(rev)
            .sort()
            .map((k) => rev[k]),
          customers: Object.keys(cust)
            .sort()
            .map((k) => cust[k].size),
        });

        const daily = build(dailyRev, dailyCust);
        const weekly = build(weeklyRev, weeklyCust);
        const monthly = build(monthlyRev, monthlyCust);

        return {
          dailyRevenue: {
            labels: daily.labels,
            data: daily.data,
          },
          weeklyRevenue: {
            labels: weekly.labels,
            data: weekly.data,
          },
          monthlyRevenue: {
            labels: monthly.labels,
            data: monthly.data,
          },
          dailyCustomers: {
            labels: daily.labels,
            data: daily.customers,
          },
          weeklyCustomers: {
            labels: weekly.labels,
            data: weekly.customers,
          },
          monthlyCustomers: {
            labels: monthly.labels,
            data: monthly.customers,
          },
        };
      },
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": buildPrivateCacheControl(CACHE_TTL_MS),
      },
    });
  } catch (err: any) {
    console.error("Charts error:", err);
    return NextResponse.json(
      { error: "Failed to generate charts" },
      { status: 500 },
    );
  }
}
