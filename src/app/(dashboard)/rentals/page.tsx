'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faFilter, faSync } from '@fortawesome/free-solid-svg-icons';
import { apiService } from '@/lib/api';
import { useLanguageStore } from '@/stores/useLanguageStore';

export default function RentalsPage() {
  const t = useLanguageStore((s) => s.t);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txRes, stRes] = await Promise.all([
        apiService.getLatestTransactions(),
        apiService.getStations(),
      ]);
      setTransactions(txRes.data || []);
      setStations(stRes.data.stations || stRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch rentals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const stationMap: Record<string, string> = {};
  stations.forEach((s: any) => { stationMap[s.imei] = s.name; });

  const filtered = transactions.filter((tx: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = tx.stationCode?.includes(q) || tx.battery_id?.toString().includes(q) || stationMap[tx.stationCode]?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || tx.status?.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp?._seconds) return 'Unknown';
    return new Date(timestamp._seconds * 1000).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rented: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      returned: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return map[status?.toLowerCase()] || map.returned;
  };

  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold dark:text-white">{t('rentals')}</h2>
          <p className="text-gray-500 dark:text-gray-400">View all power bank rental transactions</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50">
          <FontAwesomeIcon icon={faSync} spin={loading} /><span>Refresh</span>
        </button>
      </div>

      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-200">{error}</div>}

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search rentals..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500">
          <option value="all">All Status</option>
          <option value="rented">Rented</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Station</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Battery</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center"><div className="w-6 h-6 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No rentals found</td></tr>
              ) : (
                filtered.map((tx: any, index: number) => (
                  <tr key={tx.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 dark:text-white">{stationMap[tx.stationCode] || tx.stationCode || '-'}</td>
                    <td className="px-4 py-3 dark:text-white">{tx.battery_id || '-'}</td>
                    <td className="px-4 py-3 font-medium dark:text-white">${tx.amount || '0.00'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(tx.status)}`}>{tx.status || 'Unknown'}</span></td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">{formatTimestamp(tx.timestamp)}</td>
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
