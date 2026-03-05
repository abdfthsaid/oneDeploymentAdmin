"use client";

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faExclamationTriangle,
  faBatteryThreeQuarters,
} from "@fortawesome/free-solid-svg-icons";
import { useDataStore } from "@/stores/useDataStore";

interface DashboardNotificationsProps {
  showAll?: boolean;
  onViewAll?: () => void;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "success" | "error" | "warning" | "info";
  icon: any;
  priority: number;
}

export default function DashboardNotifications({
  showAll = false,
  onViewAll,
}: DashboardNotificationsProps) {
  const { transactions, stations, loading, error, refetch } = useDataStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!loading && transactions.length > 0) {
      const stationMap: Record<string, string> = {};
      stations.forEach((s: any) => {
        if (s.imei) stationMap[s.imei] = s.name;
        if (s.id) stationMap[s.id] = s.name;
        if (s.stationCode) stationMap[s.stationCode] = s.name;
      });

      const generated = generateNotifications(transactions, stationMap);
      setNotifications(generated);
    }
  }, [transactions, stations, loading]);

  const generateNotifications = (
    txs: any[],
    stationMap: Record<string, string>,
  ): Notification[] => {
    const notifs: Notification[] = [];
    const now = new Date();

    const recentTxs = txs.filter((t: any) => {
      if (!t.timestamp?._seconds) return false;
      const txTime = new Date(t.timestamp._seconds * 1000);
      return (now.getTime() - txTime.getTime()) / (1000 * 60 * 60) <= 24;
    });

    recentTxs.forEach((t: any) => {
      const stationName =
        stationMap[t.imei] ||
        stationMap[t.stationCode] ||
        t.stationName ||
        t.stationCode ||
        "Unknown";
      notifs.push({
        id: `recent-${t.id}`,
        title: "New Transaction",
        description: `Station: ${stationName} | Amount: $${t.amount} | Power Bank: ${t.battery_id}`,
        time: formatTimestamp(t.timestamp),
        type: "success",
        icon: faCheckCircle,
        priority: 2,
      });
    });

    return notifs.sort((a, b) => a.priority - b.priority);
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp?._seconds) return "Unknown time";
    const date = new Date(timestamp._seconds * 1000);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMin < 60) return `${diffMin} minutes ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hours ago`;
    return `${Math.floor(diffHr / 24)} days ago`;
  };

  const getNotificationClasses = (type: string) => {
    const map: Record<string, string> = {
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      success:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };
    return (
      map[type] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
    );
  };

  const visible = showAll ? notifications : notifications.slice(0, 3);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-gray-800 transition-colors duration-300">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">
            Recent Notifications
          </h3>
        </div>
        <div className="p-8 text-center">
          <div className="w-8 h-8 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Loading notifications...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-gray-800 transition-colors duration-300">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">
            Recent Notifications
          </h3>
        </div>
        <div className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={refetch}
            className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow dark:bg-gray-800 transition-colors duration-300">
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold dark:text-white">
            Recent Notifications
          </h3>
          {!showAll && notifications.length > 3 && (
            <button
              className="text-sm font-medium text-blue-600 dark:text-blue-400"
              onClick={onViewAll}
            >
              View All
            </button>
          )}
        </div>
      </div>
      <div className="divide-y dark:divide-gray-700">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No notifications found
          </div>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <div className="flex items-start space-x-3">
                <div
                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${getNotificationClasses(n.type)}`}
                >
                  <FontAwesomeIcon icon={n.icon} className="text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium dark:text-white">
                        {n.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {n.description}
                      </p>
                    </div>
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      {n.time}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
