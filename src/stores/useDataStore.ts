import { create } from 'zustand';
import { apiService } from '@/lib/api';

interface DataState {
  stations: any[];
  transactions: any[];
  users: any[];
  loading: boolean;
  error: string | null;

  fetchData: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useDataStore = create<DataState>((set) => ({
  stations: [],
  transactions: [],
  users: [],
  loading: true,
  error: null,

  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      const [stationsRes, transactionsRes, usersRes] = await Promise.all([
        apiService.getStations(),
        apiService.getLatestTransactions(),
        apiService.getUsers(),
      ]);
      set({
        stations: stationsRes.data.stations || stationsRes.data || [],
        transactions: transactionsRes.data || [],
        users: usersRes.data.users || usersRes.data || [],
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch data',
        loading: false,
      });
    }
  },

  refetch: async () => {
    await useDataStore.getState().fetchData();
  },
}));
