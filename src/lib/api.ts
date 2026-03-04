import axios from "axios";

// API routes are served from the same Next.js app (serverless)
const API_BASE_URL = "";

export const API_ENDPOINTS = {
  // Users
  USERS_ALL: "/api/users/all",
  USERS_LOGIN: "/api/users/login",
  USERS_ADD: "/api/users/add",
  USERS_UPDATE: "/api/users/update",
  USERS_DELETE: "/api/users/delete",
  // Stations
  STATIONS_BASIC: "/api/stations/basic",
  STATIONS_ADD: "/api/stations/add",
  STATIONS_UPDATE: "/api/stations/update",
  STATIONS_DELETE: "/api/stations/delete",
  STATIONS_STATS: "/api/stations/stats",
  // Transactions
  LATEST_TRANSACTIONS: "/api/transactions/latest",
  // Revenue
  DAILY_REVENUE: "/api/revenue/daily",
  MONTHLY_REVENUE: "/api/revenue/monthly",
  // Customers
  DAILY_CUSTOMERS_BY_IMEI: "/api/customers/daily-by-imei",
  MONTHLY_CUSTOMERS_BY_IMEI: "/api/customers/monthly-by-imei",
  DAILY_TOTAL_CUSTOMERS: "/api/customers/daily-total",
  MONTHLY_TOTAL_CUSTOMERS: "/api/customers/monthly-total",
  // Charts
  CHARTS_BY_IMEI: "/api/charts",
  CHARTS_ALL: "/api/chartsAll/all",
  // Payment
  PAYMENT_PROCESS: "/api/pay",
  // Blacklist
  BLACKLIST: "/api/blacklist",
  BLACKLIST_CHECK: "/api/blacklist/check",
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 seconds default
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - attach auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          if (typeof window !== "undefined") {
            localStorage.removeItem("authToken");
            localStorage.removeItem("sessionUser");
            localStorage.removeItem("tokenExpiresAt");
            window.location.href = "/login";
          }
          break;
        case 403:
          console.error("Access denied");
          break;
        case 500:
          console.error("Server error");
          break;
      }
    }
    return Promise.reject(error);
  },
);

// Helper to build URL with query params
function buildUrl(endpoint: string, params?: Record<string, string>): string {
  if (!params) return endpoint;
  const query = new URLSearchParams(params).toString();
  return `${endpoint}?${query}`;
}

export const apiService = {
  // Users
  getUsers: () => apiClient.get(API_ENDPOINTS.USERS_ALL),
  login: (credentials: { username: string; password: string }) =>
    apiClient.post(API_ENDPOINTS.USERS_LOGIN, credentials, { timeout: 60000 }),
  addUser: (userData: Record<string, unknown>) =>
    apiClient.post(API_ENDPOINTS.USERS_ADD, userData),
  updateUser: (username: string, data: Record<string, unknown>) =>
    apiClient.put(
      `${API_ENDPOINTS.USERS_UPDATE}?username=${encodeURIComponent(username)}`,
      data,
    ),
  deleteUser: (id: string) =>
    apiClient.delete(`${API_ENDPOINTS.USERS_DELETE}?id=${id}`),

  // Stations
  getStations: () => apiClient.get(API_ENDPOINTS.STATIONS_BASIC),
  addStation: (data: Record<string, unknown>) =>
    apiClient.post(API_ENDPOINTS.STATIONS_ADD, data),
  updateStation: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`${API_ENDPOINTS.STATIONS_UPDATE}/${id}`, data),
  deleteStation: (imei: string) =>
    apiClient.delete(`${API_ENDPOINTS.STATIONS_DELETE}/${imei}`),
  getStationStats: (imei: string) =>
    apiClient.get(`${API_ENDPOINTS.STATIONS_STATS}/${imei}`),

  // Transactions
  getLatestTransactions: () => apiClient.get(API_ENDPOINTS.LATEST_TRANSACTIONS),

  // Revenue
  getDailyRevenue: (imei?: string) =>
    imei
      ? apiClient.get(`${API_ENDPOINTS.DAILY_REVENUE}/${imei}`)
      : apiClient.get(API_ENDPOINTS.DAILY_REVENUE),
  getMonthlyRevenue: (imei?: string) =>
    imei
      ? apiClient.get(`${API_ENDPOINTS.MONTHLY_REVENUE}/${imei}`)
      : apiClient.get(API_ENDPOINTS.MONTHLY_REVENUE),
  getAllDailyRevenue: () => apiClient.get(API_ENDPOINTS.DAILY_REVENUE),
  getAllMonthlyRevenue: () => apiClient.get(API_ENDPOINTS.MONTHLY_REVENUE),

  // Customers
  getDailyCustomers: (imei: string) =>
    apiClient.get(`${API_ENDPOINTS.DAILY_CUSTOMERS_BY_IMEI}/${imei}`),
  getMonthlyCustomers: (imei: string) =>
    apiClient.get(`${API_ENDPOINTS.MONTHLY_CUSTOMERS_BY_IMEI}/${imei}`),
  getDailyTotalCustomers: () =>
    apiClient.get(API_ENDPOINTS.DAILY_TOTAL_CUSTOMERS),
  getMonthlyTotalCustomers: () =>
    apiClient.get(API_ENDPOINTS.MONTHLY_TOTAL_CUSTOMERS),

  // Charts
  getChartsByImei: (imei: string) =>
    apiClient.get(`${API_ENDPOINTS.CHARTS_BY_IMEI}/${imei}`),
  getAllCharts: () => apiClient.get(API_ENDPOINTS.CHARTS_ALL),

  // Blacklist
  getBlacklist: () => apiClient.get(API_ENDPOINTS.BLACKLIST),
  addToBlacklist: (data: Record<string, unknown>) =>
    apiClient.post(API_ENDPOINTS.BLACKLIST, data),
  checkBlacklist: (phoneNumber: string) =>
    apiClient.get(`${API_ENDPOINTS.BLACKLIST_CHECK}/${phoneNumber}`),
  removeFromBlacklist: (id: string) =>
    apiClient.delete(`${API_ENDPOINTS.BLACKLIST}/${id}`),

  // Payment
  processPayment: (stationCode: string, data: Record<string, unknown>) =>
    apiClient.post(`${API_ENDPOINTS.PAYMENT_PROCESS}/${stationCode}`, data),
};
