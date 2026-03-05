"use client";

import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faUsers,
  faCalendarDay,
  faMoneyBillWave,
  faCalendar,
  faSyncAlt,
} from "@fortawesome/free-solid-svg-icons";
import { apiService } from "@/lib/api";

const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 minutes

export default function StatsCards() {
  const [monthlyData, setMonthlyData] = useState({
    month: "",
    totalCustomersThisMonth: 0,
    stations: 0,
  });
  const [dailyData, setDailyData] = useState({
    date: "",
    totalCustomersToday: 0,
    stations: 0,
  });
  const [revenueData, setRevenueData] = useState({
    totalRevenueMonthly: 0,
    totalRentalsThisMonth: 0,
    month: "",
  });
  const [dailyRevenueData, setDailyRevenueData] = useState({
    totalRevenueToday: 0,
    totalRentalsToday: 0,
    date: "",
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const summaryRes = await apiService.getDashboardSummary();
      const summary = summaryRes.data || {};
      const daily = summary.daily || {};
      const monthly = summary.monthly || {};

      setRevenueData({
        totalRevenueMonthly: monthly.totalRevenueMonthly || 0,
        totalRentalsThisMonth: monthly.totalRentalsThisMonth || 0,
        month: monthly.month || "",
      });

      setDailyRevenueData({
        totalRevenueToday: daily.totalRevenueToday || 0,
        totalRentalsToday: daily.totalRentalsToday || 0,
        date: daily.date || "",
      });

      setMonthlyData({
        month: monthly.month || "",
        totalCustomersThisMonth: monthly.totalCustomersThisMonth || 0,
        stations: monthly.stations || 0,
      });

      setDailyData({
        date: daily.date || "",
        totalCustomersToday: daily.totalCustomersToday || 0,
        stations: daily.stations || 0,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const stats = [
    {
      title: `Total Revenue (${revenueData.month || "Month"})`,
      value: `$${revenueData.totalRevenueMonthly.toFixed(2)}`,
      change: `${revenueData.totalRentalsThisMonth} rentals`,
      progress: 85,
      color: "blue",
      icon: (
        <FontAwesomeIcon icon={faMoneyBillWave} className="text-blue-500" />
      ),
    },
    {
      title: `Total Customers (${monthlyData.month || "Month"})`,
      value: monthlyData.totalCustomersThisMonth.toString(),
      change: `$${revenueData.totalRevenueMonthly.toFixed(2)} revenue`,
      progress: 78,
      color: "green",
      icon: <FontAwesomeIcon icon={faUsers} className="text-green-500" />,
    },
    {
      title: `Total Revenue (Today)`,
      value: `$${dailyRevenueData.totalRevenueToday.toFixed(2)}`,
      change: `${dailyRevenueData.totalRentalsToday} rentals`,
      progress: 60,
      color: "indigo",
      icon: <FontAwesomeIcon icon={faCalendar} className="text-indigo-500" />,
    },
    {
      title: `Total Customers (Today)`,
      value: dailyData.totalCustomersToday.toString(),
      change: `$${dailyRevenueData.totalRevenueToday.toFixed(2)} revenue`,
      progress: 40,
      color: "pink",
      icon: <FontAwesomeIcon icon={faCalendarDay} className="text-pink-500" />,
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      yellow: "bg-yellow-500",
      indigo: "bg-indigo-500",
      pink: "bg-pink-500",
    };
    return colors[color] || "bg-blue-500";
  };

  const formatLastUpdated = (date: Date) => {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    const s = date.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  return (
    <>
      {/* Refresh bar spanning full grid width */}
      <div className="flex items-center justify-between col-span-1 md:col-span-2 lg:col-span-4">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {lastUpdated
            ? `Last updated: ${formatLastUpdated(lastUpdated)}`
            : "Loading..."}
          {refreshing && " — Refreshing..."}
        </p>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          <FontAwesomeIcon
            icon={faSyncAlt}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {stats.map((stat, index) => (
        <div
          key={index}
          className="p-6 transition-colors duration-300 bg-white rounded-lg shadow dark:bg-gray-800"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stat.title}
              </p>
              <h3 className="mt-1 text-2xl font-bold dark:text-white">
                {stat.value}
              </h3>
            </div>
            <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs font-medium px-2 py-0.5 rounded-full flex items-center">
              {stat.icon && <span className="mr-1">{stat.icon}</span>}
              <FontAwesomeIcon icon={faArrowUp} className="mr-1" />
              {stat.change}
            </span>
          </div>
          <div className="h-2 mt-4 bg-gray-200 rounded-full dark:bg-gray-700">
            <div
              className={`h-2 rounded-full ${getColorClasses(stat.color)}`}
              style={{ width: `${stat.progress}%` }}
            ></div>
          </div>
        </div>
      ))}
    </>
  );
}
