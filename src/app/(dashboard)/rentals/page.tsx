"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faSearch,
  faSync,
} from "@fortawesome/free-solid-svg-icons";

import { apiService } from "@/lib/api";
import { useLanguageStore } from "@/stores/useLanguageStore";

function formatTimestamp(timestamp: any) {
  if (!timestamp?._seconds) return "Unknown";

  return new Date(timestamp._seconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    completed:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rented: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    returned:
      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  };

  return map[status?.toLowerCase()] || map.returned;
}

function formatPhoneNumber(phone: string) {
  if (!phone) return "-";

  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 9) {
    return `+252 ${cleaned}`;
  }

  return phone;
}

export default function TransactionsPage() {
  const t = useLanguageStore((s) => s.t);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");

  const fetchData = async (fresh = false) => {
    try {
      setLoading(true);
      setError("");

      const [txRes, stRes] = await Promise.all([
        apiService.getTransactionHistory(fresh),
        apiService.getStations(),
      ]);

      setTransactions(txRes.data || []);
      setStations(stRes.data.stations || stRes.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch transaction history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const stationNameByKey = useMemo(() => {
    const map: Record<string, string> = {};

    stations.forEach((station: any) => {
      if (station?.imei) map[station.imei] = station.name || station.imei;
      if (station?.id) map[station.id] = station.name || station.id;
      if (station?.stationCode) {
        map[station.stationCode] = station.name || station.stationCode;
      }
    });

    return map;
  }, [stations]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions.filter((tx: any) => {
      const normalizedStatus = tx.status?.toLowerCase() || "";
      const normalizedStation =
        tx.imei || tx.stationCode || tx.stationName || "";

      const matchesStatus =
        statusFilter === "all" || normalizedStatus === statusFilter;
      const matchesStation =
        stationFilter === "all" || normalizedStation === stationFilter;

      if (!matchesStatus || !matchesStation) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        tx.id,
        tx.phoneNumber,
        tx.battery_id,
        tx.slot_id,
        tx.stationCode,
        tx.imei,
        tx.stationName,
        stationNameByKey[tx.imei] || "",
        tx.transactionId,
        tx.issuerTransactionId,
        tx.referenceId,
        tx.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [transactions, searchQuery, statusFilter, stationFilter, stationNameByKey]);

  const stationOptions = useMemo(() => {
    const options = transactions
      .map((tx: any) => ({
        value: tx.imei || tx.stationCode || tx.stationName,
        label:
          stationNameByKey[tx.imei] ||
          tx.stationName ||
          tx.stationCode ||
          tx.imei,
      }))
      .filter((option) => option.value && option.label);

    const deduped = new Map<string, string>();
    options.forEach((option) => {
      if (!deduped.has(option.value)) {
        deduped.set(option.value, option.label);
      }
    });

    return Array.from(deduped.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [transactions, stationNameByKey]);

  return (
    <div className="p-4">
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold dark:text-white">
            {t("transactions")}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Full transaction history with phone, station, and Waafi reference
            search
          </p>
        </div>

        <button
          onClick={() => void fetchData(true)}
          disabled={loading}
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faSync} spin={loading} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-3 mb-4 md:grid-cols-[2fr,1fr,1fr]">
        <div className="relative">
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-3 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phone, station, battery, ref, or transaction ID"
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative">
          <FontAwesomeIcon
            icon={faFilter}
            className="absolute left-3 top-3 text-gray-400"
          />
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Stations</option>
            {stationOptions.map((station) => (
              <option key={station.value} value={station.value}>
                {station.label}
              </option>
            ))}
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="rented">Rented</option>
          <option value="returned">Returned</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Showing {filteredTransactions.length} of {transactions.length}{" "}
        transactions
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Station
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Battery / Slot
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Waafi IDs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="w-6 h-6 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx: any) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 align-top"
                  >
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatTimestamp(tx.timestamp)}
                    </td>
                    <td className="px-4 py-3 dark:text-white">
                      {formatPhoneNumber(tx.phoneNumber)}
                    </td>
                    <td className="px-4 py-3 dark:text-white">
                      {stationNameByKey[tx.imei] ||
                        tx.stationName ||
                        tx.stationCode ||
                        tx.imei ||
                        "-"}
                    </td>
                    <td className="px-4 py-3 dark:text-white">
                      <div className="font-medium">{tx.battery_id || "-"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Slot {tx.slot_id || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium dark:text-white">
                      ${Number(tx.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(
                          tx.status,
                        )}`}
                      >
                        {tx.status || "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm dark:text-white">
                      <div className="font-mono break-all">
                        TX: {tx.transactionId || "-"}
                      </div>
                      <div className="font-mono break-all text-gray-500 dark:text-gray-400">
                        Issuer: {tx.issuerTransactionId || "-"}
                      </div>
                      <div className="font-mono break-all text-gray-500 dark:text-gray-400">
                        Ref: {tx.referenceId || "-"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
