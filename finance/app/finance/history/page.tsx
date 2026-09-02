'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { getPaymentHistory } from '@/lib/api';

type HistoryPayment = {
  payment_id: string;
  worker_name: string;
  worker_phone: string;
  worker_upi_id: string;
  job_name: string;
  store_name: string;
  shift_date: string;
  hours_duration: number;
  amount: number;
  transaction_reference: string;
  processed_at: string;
  remarks: string | null;
  payment_status: 'completed' | 'failed';
};

type GroupedHistory = {
  worker_phone: string;
  worker_name: string;
  worker_upi_id: string;
  total_amount: number;
  payments: HistoryPayment[];
  latest_payment_date: string;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const fetchHistory = async () => {
    try {
      setLoading(true);
      try {
        const res = await getPaymentHistory();
        setHistory(res.data.payments || []);
      } catch (err) {
        console.error("API failed to fetch history", err);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const toggleGroup = (phone: string) => {
    setExpandedGroups(prev => ({ ...prev, [phone]: !prev[phone] }));
  };

  const filteredHistory = history.filter(p =>
    p.worker_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.transaction_reference && p.transaction_reference.includes(search)) ||
    p.worker_phone.includes(search)
  );

  // Group payments by worker
  const groupedHistoryMap = filteredHistory.reduce((acc, curr) => {
    if (!acc[curr.worker_phone]) {
      acc[curr.worker_phone] = {
        worker_name: curr.worker_name,
        worker_phone: curr.worker_phone,
        worker_upi_id: curr.worker_upi_id || 'N/A',
        total_amount: 0,
        payments: [],
        latest_payment_date: curr.processed_at || ''
      };
    }
    acc[curr.worker_phone].total_amount += curr.amount;
    acc[curr.worker_phone].payments.push(curr);

    // Keep track of the most recent payment date for sorting/display
    if (curr.processed_at && curr.processed_at > acc[curr.worker_phone].latest_payment_date) {
      acc[curr.worker_phone].latest_payment_date = curr.processed_at;
    }

    return acc;
  }, {} as Record<string, GroupedHistory>);

  // Sort groups so the most recently paid workers appear at the top
  const groupedHistory = Object.values(groupedHistoryMap).sort((a, b) =>
    b.latest_payment_date.localeCompare(a.latest_payment_date)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-cream shadow-sm border border-gray-100">
        <div className="border-b border-gray-200 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate">Payment History</h2>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, phone or UTR..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2 text-sm focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss sm:w-64"
                />
              </div>

              <div className="flex gap-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2 text-sm focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss text-slate"
                  />
                </div>
                <button className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-slate hover:bg-gray-200 transition-colors">
                  Filter
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate">
            <thead className="bg-sand text-xs uppercase text-sage">
              <tr>
                <th className="px-6 py-3">Sahyogi Details</th>
                <th className="px-6 py-3">UPI ID</th>
                <th className="px-6 py-3">Jobs Summary</th>
                <th className="px-6 py-3">Total Amount Paid</th>
                <th className="px-6 py-3">Latest Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sage">
                    <div className="flex justify-center items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-moss border-t-transparent"></div>
                      Loading history...
                    </div>
                  </td>
                </tr>
              ) : groupedHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sage">
                    No payment history found.
                  </td>
                </tr>
              ) : (
                groupedHistory.map((group) => (
                  <React.Fragment key={group.worker_phone}>
                    {/* Parent Row (Group) */}
                    <tr
                      className={`hover:bg-gray-50/50 cursor-pointer ${expandedGroups[group.worker_phone] ? 'bg-gray-50/50' : ''}`}
                      onClick={() => toggleGroup(group.worker_phone)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {expandedGroups[group.worker_phone] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                          <div>
                            <div className="font-medium text-slate">{group.worker_name}</div>
                            <div className="text-xs text-sage">{group.worker_phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs">{group.worker_upi_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate">{group.payments.length} completed job(s)</div>
                        <div className="text-xs text-sage">Click to view breakdown</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-moss text-base">
                        {formatCurrency(group.total_amount)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate">{formatDate(group.latest_payment_date)}</div>
                      </td>
                    </tr>

                    {/* Child Rows (Individual Payments Breakdown) */}
                    {expandedGroups[group.worker_phone] && group.payments.map((payment) => (
                      <tr key={payment.payment_id} className="bg-sand/30 hover:bg-sand/60 border-t-0">
                        <td className="px-6 py-3 pl-14" colSpan={2}>
                          <div className="font-mono text-xs text-slate">UTR: {payment.transaction_reference || 'N/A'}</div>
                          <div className="text-xs text-sage">Processed: {payment.processed_at ? formatDate(payment.processed_at) : 'N/A'}</div>
                          {payment.remarks && (
                            <div className="mt-1 text-xs italic text-gray-500">"{payment.remarks}"</div>
                          )}
                        </td>
                        <td className="px-6 py-3 border-l border-gray-100">
                          <div className="text-sm font-medium text-slate">{payment.job_name}</div>
                          <div className="text-xs text-sage">{payment.store_name} • {payment.shift_date}</div>
                        </td>
                        <td className="px-6 py-3 font-medium text-slate border-l border-gray-100">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${payment.payment_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-clay/10 text-clay'
                            }`}>
                            {payment.payment_status.charAt(0).toUpperCase() + payment.payment_status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Dummy */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
          <div className="text-sm text-sage">
            Showing <span className="font-medium">1</span> to <span className="font-medium">{groupedHistory.length}</span> of <span className="font-medium">{groupedHistory.length}</span> Sahogi
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-gray-200 p-1 text-gray-400 disabled:opacity-50 hover:bg-gray-50" disabled>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button className="rounded-lg border border-gray-200 p-1 text-gray-400 disabled:opacity-50 hover:bg-gray-50" disabled>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
