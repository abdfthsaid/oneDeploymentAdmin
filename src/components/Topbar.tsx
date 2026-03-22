"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faSearch,
  faBell,
  faCheckCircle,
  faSignOutAlt,
  faSpinner,
  faStore,
  faUsers,
  faExchangeAlt,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDataStore } from "@/stores/useDataStore";
import { useLanguageStore } from "@/stores/useLanguageStore";
import { isAdmin, getUserDisplayRole } from "@/lib/utils/roleUtils";

interface TopbarProps {
  setSidebarOpen: (open: boolean) => void;
}

export default function Topbar({ setSidebarOpen }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const {
    stations,
    transactions,
    users: contextUsers,
    loading: contextLoading,
  } = useDataStore();
  const t = useLanguageStore((s) => s.t);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const userIsAdmin = isAdmin(user);
  const stationNameByKey = useMemo(() => {
    const map: Record<string, string> = {};
    stations.forEach((station: any) => {
      if (station?.imei) map[station.imei] = station.name || station.imei;
      if (station?.id) map[station.id] = station.name || station.id;
      if (station?.name) map[station.name] = station.name;
    });
    return map;
  }, [stations]);

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const seenNotificationsStorageKey = useMemo(
    () =>
      `topbar:seen-notifications:${user?.username || user?.id || user?._id || user?.name || "guest"}`,
    [user?.username, user?.id, user?._id, user?.name],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(seenNotificationsStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSeenNotificationIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSeenNotificationIds([]);
    }
  }, [seenNotificationsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      seenNotificationsStorageKey,
      JSON.stringify(seenNotificationIds),
    );
  }, [seenNotificationIds, seenNotificationsStorageKey]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setNotificationOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search functionality
  const performSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const results: any[] = [];
    const searchTerm = query.toLowerCase();

    stations.forEach((station: any) => {
      if (
        station.name?.toLowerCase().includes(searchTerm) ||
        station.location?.toLowerCase().includes(searchTerm) ||
        station.imei?.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          type: "station",
          id: station.id,
          title: station.name,
          subtitle: station.location,
          icon: faStore,
          data: station,
        });
      }
    });

    if (userIsAdmin) {
      (contextUsers || []).forEach((u: any) => {
        if (
          u.username?.toLowerCase().includes(searchTerm) ||
          u.email?.toLowerCase().includes(searchTerm) ||
          u.role?.toLowerCase().includes(searchTerm)
        ) {
          results.push({
            type: "user",
            id: u.id,
            title: u.username || u.fullName,
            subtitle: u.email || u.role,
            icon: faUsers,
            data: u,
          });
        }
      });
    }

    transactions.forEach((tx: any) => {
      if (
        tx.id?.toString().includes(searchTerm) ||
        tx.stationName?.toLowerCase().includes(searchTerm) ||
        tx.battery_id?.toLowerCase().includes(searchTerm) ||
        tx.phoneNumber?.includes(searchTerm)
      ) {
        results.push({
          type: "transaction",
          id: tx.id,
          title: `Transaction #${tx.id}`,
          subtitle: `${tx.stationName} - $${tx.amount}`,
          icon: faExchangeAlt,
          data: tx,
        });
      }
    });

    setSearchResults(results.slice(0, 10));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchQuery, stations, contextUsers, transactions, userIsAdmin]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSearchOpen(query.trim().length > 0);
  };

  const handleSearchResultClick = (result: any) => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    switch (result.type) {
      case "station":
        router.push(`/station/${result.data.imei}`);
        break;
      case "user":
        router.push("/users");
        break;
      case "transaction":
        router.push("/rentals");
        break;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      "/dashboard": t("dashboard"),
      "/stations": t("stations"),
      "/slots": t("slots"),
      "/revenue": t("revenue"),
      "/rentals": t("transactions"),
      "/users": t("users"),
      "/powerbanks": "Power Banks",
      "/notifications": t("notifications"),
      "/settings": t("settings"),
      "/blacklist": "Blacklist",
      "/station-comparison": "Station Comparison",
    };
    return titles[pathname] || t("dashboard");
  };

  // Generate notifications from transactions
  useEffect(() => {
    if (!contextLoading && transactions.length > 0) {
      setLoading(true);
      const now = new Date();
      const recentTransactions = transactions.filter((tx: any) => {
        const txTime = new Date(tx.timestamp?._seconds * 1000);
        const hoursDiff = (now.getTime() - txTime.getTime()) / (1000 * 60 * 60);
        return hoursDiff <= 2;
      });

        const generated = recentTransactions.map((tx: any) => ({
        id: `recent-${tx.id}`,
        title: "New Transaction",
        description: `Station: ${stationNameByKey[tx.stationName] || tx.stationName} | Amount: $${tx.amount} | Power Bank: ${tx.battery_id}`,
        time: formatTimestamp(tx.timestamp),
        type: "success",
        icon: faCheckCircle,
      }));
      setNotifications(generated.slice(0, 5));
      setLoading(false);
    }
  }, [transactions, contextLoading, stationNameByKey]);

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp || !timestamp._seconds) return "Unknown time";
    const date = new Date(timestamp._seconds * 1000);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60),
      );
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else {
      return `${Math.floor(diffInHours / 24)} days ago`;
    }
  };

  const getNotificationClasses = (type: string) => {
    const classMap: Record<string, string> = {
      warning:
        "bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400",
      error: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
      success:
        "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
    };
    return (
      classMap[type] ||
      "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
    );
  };

  const unreadNotificationCount = notifications.filter(
    (notification) => !seenNotificationIds.includes(notification.id),
  ).length;

  const markNotificationsSeen = () => {
    if (notifications.length === 0) return;

    setSeenNotificationIds((current) => {
      const merged = new Set(current);
      notifications.forEach((notification) => {
        if (notification?.id) {
          merged.add(notification.id);
        }
      });
      return Array.from(merged);
    });
  };

  useEffect(() => {
    if (pathname !== "/notifications" || notifications.length === 0) return;

    setSeenNotificationIds((current) => {
      const merged = new Set(current);
      notifications.forEach((notification) => {
        if (notification?.id) {
          merged.add(notification.id);
        }
      });
      return Array.from(merged);
    });
  }, [pathname, notifications]);

  return (
    <header className="flex items-center justify-between p-4 transition-colors duration-300 bg-white shadow-sm dark:bg-gray-800">
      <div className="flex items-center">
        <button
          onClick={() => setSidebarOpen(true)}
          className="mr-4 text-gray-500 lg:hidden dark:text-gray-400"
        >
          <FontAwesomeIcon icon={faBars} className="text-xl" />
        </button>
        <h2
          className="text-xl font-semibold text-gray-800 transition-colors cursor-pointer dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
          onClick={() => router.push("/dashboard")}
        >
          {getPageTitle()}
        </h2>
      </div>

      <div className="flex items-center space-x-4">
        {/* Search Bar - Desktop */}
        <div className="relative hidden md:block" ref={searchRef}>
          <div className="relative">
            <input
              type="text"
              placeholder={t("search")}
              value={searchQuery}
              onChange={handleSearchChange}
              className="py-2 pl-10 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            />
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute text-gray-400 left-3 top-3"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchOpen(false);
                }}
                className="absolute text-gray-400 right-3 top-3 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchOpen && (
            <div className="absolute right-0 z-50 mt-2 bg-white rounded-md shadow-lg w-96 dark:bg-gray-800 max-h-96 overflow-y-auto">
              <div className="p-3 border-b dark:border-gray-700">
                <p className="font-medium dark:text-white">
                  {`${searchResults.length} results`}
                </p>
              </div>
              <div className="divide-y dark:divide-gray-700">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? t("noDataFound") : t("search")}
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSearchResultClick(result)}
                      className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={result.icon}
                            className="text-blue-600 dark:text-blue-400 text-sm"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium dark:text-white truncate">
                            {result.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {result.subtitle}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              result.type === "station"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : result.type === "user"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            }`}
                          >
                            {result.type}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Search Button */}
        <button
          onClick={() => {
            const searchInput = document.querySelector(
              'input[placeholder*="Search"]',
            ) as HTMLInputElement;
            if (searchInput) searchInput.focus();
          }}
          className="md:hidden p-2 text-gray-500 rounded-lg dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FontAwesomeIcon icon={faSearch} />
        </button>

        <div className="flex items-center space-x-2">
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => {
                const nextOpen = !notificationOpen;
                setNotificationOpen(nextOpen);
                if (nextOpen) {
                  markNotificationsSeen();
                }
              }}
              className="relative p-2 text-gray-500 rounded-lg dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FontAwesomeIcon icon={faBell} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-10">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </button>
            {notificationOpen && (
              <div className="absolute right-0 z-50 mt-2 bg-white rounded-md shadow-lg w-72 dark:bg-gray-800">
                <div className="p-3 border-b dark:border-gray-700">
                  <p className="font-medium dark:text-white">
                    {t("notifications")}
                  </p>
                  {!userIsAdmin && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Limited view for regular users
                    </p>
                  )}
                </div>
                <div className="overflow-y-auto divide-y dark:divide-gray-700 max-h-60">
                  {loading ? (
                    <div className="p-4 text-center">
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                        className="text-blue-600"
                      />
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {t("loading")}
                      </p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-start p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div
                          className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${getNotificationClasses(notification.type)}`}
                        >
                          <FontAwesomeIcon icon={notification.icon} />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {notification.description}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 text-center border-t dark:border-gray-700">
                  <a
                    href="/notifications"
                    onClick={markNotificationsSeen}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400"
                  >
                    {t("viewAll")} {t("notifications")}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-2 text-gray-500 rounded-lg dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="hidden md:block text-sm font-medium dark:text-white">
                {user?.username || "User"}
              </span>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 bg-white rounded-md shadow-lg w-48 dark:bg-gray-800">
                <div className="p-3 border-b dark:border-gray-700">
                  <p className="font-medium dark:text-white">
                    {user?.username || "User"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {getUserDisplayRole(user)}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      router.push("/settings");
                      setUserMenuOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t("settings")}
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                      router.push("/login");
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" />
                    {t("signOut")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
