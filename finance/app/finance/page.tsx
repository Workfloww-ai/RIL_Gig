'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, IndianRupee } from 'lucide-react';
import { getDashboardStats, getPendingPayments, processPayment } from '@/lib/api';

// Types
type DashboardStats = {
  total_pending_count: number;
  total_pending_amount: number;
  processed_today_count: number;
  processed_today_amount: number;
  processed_this_month_count: number;
  processed_this_month_amount: number;
};

type Payment = {
  payment_id: string;
  worker_name: string;
  worker_phone: string;
  worker_upi_id: string;
  job_name: string;
  store_name: string;
  shift_date: string;
  hours_duration: number;
  amount: number;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed';
  transaction_reference?: string;
  processed_at?: string;
  remarks?: string;
  created_at?: string;
};

type GroupedPayment = {
  worker_phone: string;
  worker_name: string;
  worker_upi_id: string;
  total_amount: number;
  payments: Payment[];
  status: string;
};

export default function FinanceDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUpi, setCopiedUpi] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupedPayment | null>(null);

  const [utrNumber, setUtrNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      try {
        const [statsRes, paymentsRes] = await Promise.all([
          getDashboardStats(),
          getPendingPayments()
        ]);
        setStats(statsRes.data);
        setPayments(paymentsRes.data.payments || paymentsRes.data);
      } catch (err) {
        console.error("API failed to fetch live data", err);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCopyUpi = (upiId: string) => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(upiId);
    setTimeout(() => setCopiedUpi(null), 2000);
  };

  const toggleGroup = (phone: string) => {
    setExpandedGroups(prev => ({ ...prev, [phone]: !prev[phone] }));
  };

  const handleProcessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment && !selectedGroup) return;

    setProcessing(true);
    setProcessError('');

    try {
      if (selectedGroup) {
        // Process all payments in the group
        await Promise.all(selectedGroup.payments.map(p =>
          processPayment(p.payment_id, { transaction_reference: utrNumber, remarks })
        ));

        const paymentIds = selectedGroup.payments.map(p => p.payment_id);
        setPayments(payments.filter(p => !paymentIds.includes(p.payment_id)));

        if (stats) {
          setStats({
            ...stats,
            total_pending_count: stats.total_pending_count - selectedGroup.payments.length,
            total_pending_amount: stats.total_pending_amount - selectedGroup.total_amount,
            processed_today_count: stats.processed_today_count + selectedGroup.payments.length,
            processed_today_amount: stats.processed_today_amount + selectedGroup.total_amount
          });
        }
      } else if (selectedPayment) {
        // Process single payment
        await processPayment(selectedPayment.payment_id, { transaction_reference: utrNumber, remarks });

        setPayments(payments.filter(p => p.payment_id !== selectedPayment.payment_id));

        if (stats) {
          setStats({
            ...stats,
            total_pending_count: stats.total_pending_count - 1,
            total_pending_amount: stats.total_pending_amount - selectedPayment.amount,
            processed_today_count: stats.processed_today_count + 1,
            processed_today_amount: stats.processed_today_amount + selectedPayment.amount
          });
        }
      }

      setSelectedPayment(null);
      setSelectedGroup(null);
      setUtrNumber('');
      setRemarks('');
    } catch (err: any) {
      console.error(err);
      setProcessError(err.response?.data?.detail || 'Failed to process payment(s)');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.worker_name.toLowerCase().includes(search.toLowerCase()) ||
      p.worker_phone.includes(search);
    const matchesStatus = statusFilter === 'all' || p.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getLocalYYYYMMDD = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getLocalYYYYMMDD();

  // Present = job completed (created_at) today before 20:00 (8 PM)
  // Fallback if no created_at: shift_date >= todayStr
  const isPresentJob = (p: Payment) => {
    if (!p.created_at) {
      return p.shift_date >= todayStr;
    }
    const createdAt = new Date(p.created_at);
    const today = new Date();
    const isToday = createdAt.getDate() === today.getDate() &&
      createdAt.getMonth() === today.getMonth() &&
      createdAt.getFullYear() === today.getFullYear();

    // completed today AND before 20:00 local time
    if (isToday && createdAt.getHours() < 20) {
      return true;
    }
    return false;
  };

  const isPastJob = (p: Payment) => {
    if (!p.created_at) {
      return p.shift_date < todayStr;
    }
    const createdAt = new Date(p.created_at);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return createdAt < startOfToday;
  };

  const groupPayments = (paymentList: Payment[]) => {
    const grouped = paymentList.reduce((acc, curr) => {
      if (!acc[curr.worker_phone]) {
        acc[curr.worker_phone] = {
          worker_name: curr.worker_name,
          worker_phone: curr.worker_phone,
          worker_upi_id: curr.worker_upi_id || 'N/A',
          total_amount: 0,
          payments: [],
          status: curr.payment_status
        };
      }
      acc[curr.worker_phone].total_amount += curr.amount;
      acc[curr.worker_phone].payments.push(curr);
      if (acc[curr.worker_phone].status !== curr.payment_status) {
        acc[curr.worker_phone].status = 'mixed';
      }
      return acc;
    }, {} as Record<string, GroupedPayment>);
    return Object.values(grouped);
  };

  const presentPayments = filteredPayments.filter(p => isPresentJob(p));
  const pastPayments = filteredPayments.filter(p => isPastJob(p));

  const presentGroups = groupPayments(presentPayments);
  const pastGroups = groupPayments(pastPayments);

  const renderTableRows = (groups: GroupedPayment[], emptyMessage: string) => {
    if (loading) {
      return (
        <tr>
          <td colSpan={6} className="px-6 py-8 text-center text-sage">
            <div className="flex justify-center items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-moss border-t-transparent"></div>
              Loading payments...
            </div>
          </td>
        </tr>
      );
    }
    if (groups.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="px-6 py-8 text-center text-sage">
            {emptyMessage}
          </td>
        </tr>
      );
    }
    return groups.map((group) => (
      <React.Fragment key={group.worker_phone}>
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
          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{group.worker_upi_id}</span>
              <button
                onClick={() => handleCopyUpi(group.worker_upi_id)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-moss transition-colors relative"
                title="Copy UPI ID"
              >
                {copiedUpi === group.worker_upi_id ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="text-sm font-medium text-slate">{group.payments.length} pending job(s)</div>
            <div className="text-xs text-sage">Click to view breakdown</div>
          </td>
          <td className="px-6 py-4 font-bold text-slate text-base">
            {formatCurrency(group.total_amount)}
          </td>
          <td className="px-6 py-4">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${group.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              group.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
              {group.status.charAt(0).toUpperCase() + group.status.slice(1)}
            </span>
          </td>
          <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedGroup(group)}
              className="rounded-lg bg-clay px-4 py-2 text-xs font-semibold text-white hover:bg-clay/90 transition-colors shadow-sm"
            >
              Process Total
            </button>
          </td>
        </tr>

        {expandedGroups[group.worker_phone] && group.payments.map((payment) => (
          <tr key={payment.payment_id} className="bg-sand/30 hover:bg-sand/60 border-t-0">
            <td className="px-6 py-3 pl-14">
              <div className="text-xs text-sage">Job Ref:</div>
              <div className="font-mono text-xs text-gray-400">{payment.payment_id.slice(0, 8)}...</div>
            </td>
            <td className="px-6 py-3"></td>
            <td className="px-6 py-3 border-l border-gray-100">
              <div className="text-sm font-medium text-slate">{payment.job_name}</div>
              <div className="text-xs text-sage">{payment.store_name} • {payment.shift_date}</div>
            </td>
            <td className="px-6 py-3 font-medium text-slate border-l border-gray-100">
              {formatCurrency(payment.amount)}
            </td>
            <td className="px-6 py-3">
              <span className="inline-flex items-center text-xs text-sage">
                {payment.payment_status}
              </span>
            </td>
            <td className="px-6 py-3 text-right">
              <button
                onClick={() => setSelectedPayment(payment)}
                className="rounded px-2 py-1 text-xs font-medium text-moss border border-moss hover:bg-moss hover:text-white transition-colors"
              >
                Process Single
              </button>
            </td>
          </tr>
        ))}
      </React.Fragment>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-cream p-6 shadow-sm border-l-4 border-moss">
          <h3 className="text-sm font-medium text-sage">Total Pending</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate">{stats ? formatCurrency(stats.total_pending_amount) : '₹0.00'}</span>
          </div>
          <p className="mt-1 text-sm text-sage">{stats?.total_pending_count || 0} payments to process</p>
        </div>

        <div className="rounded-xl bg-cream p-6 shadow-sm border-l-4 border-clay">
          <h3 className="text-sm font-medium text-sage">Processed Today</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate">{stats ? formatCurrency(stats.processed_today_amount) : '₹0.00'}</span>
          </div>
          <p className="mt-1 text-sm text-sage">{stats?.processed_today_count || 0} payments processed</p>
        </div>

        <div className="rounded-xl bg-cream p-6 shadow-sm border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-sage">Completed This Month</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate">{stats ? formatCurrency(stats.processed_this_month_amount) : '₹0.00'}</span>
          </div>
          <p className="mt-1 text-sm text-sage">{stats?.processed_this_month_count || 0} successful payments</p>
        </div>

        <div className="rounded-xl bg-moss p-6 shadow-sm text-white">
          <h3 className="text-sm font-medium text-green-100">Total Amount Processed</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stats ? formatCurrency(stats.processed_this_month_amount) : '₹0.00'}</span>
          </div>
          <p className="mt-1 text-sm text-green-200">This month's volume</p>
        </div>
      </div>

      {/* Main Filter Section */}
      <div className="rounded-xl bg-cream shadow-sm border border-gray-100">
        <div className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate">Pending Payments</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2 text-sm focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Present Jobs Section */}
      <div className="rounded-xl bg-cream shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div className="bg-sand border-b border-gray-200 p-3 px-4 flex items-center justify-between">
          <h3 className="font-semibold text-moss">Today's Jobs</h3>
          <span className="text-xs font-medium bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full">{presentGroups.length} Sahyogi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate">
            <thead className="bg-gray-50 text-xs uppercase text-sage border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Sahyogi Details</th>
                <th className="px-6 py-3">UPI ID</th>
                <th className="px-6 py-3">Jobs Summary</th>
                <th className="px-6 py-3">Total Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {renderTableRows(presentGroups, "No present jobs completed today before 8 PM.")}
            </tbody>
          </table>
        </div>
      </div>

      {/* Past Jobs Section */}
      <div className="rounded-xl bg-cream shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div className="bg-sand border-b border-gray-200 p-3 px-4 flex items-center justify-between">
          <h3 className="font-semibold text-clay">Past / Rollover Jobs</h3>
          <span className="text-xs font-medium bg-clay/10 text-clay px-2.5 py-0.5 rounded-full">{pastGroups.length}Sahyogi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate">
            <thead className="bg-gray-50 text-xs uppercase text-sage border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Sahyogi Details</th>
                <th className="px-6 py-3">UPI ID</th>
                <th className="px-6 py-3">Jobs Summary</th>
                <th className="px-6 py-3">Total Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {renderTableRows(pastGroups, "No past or rollover jobs pending.")}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {(selectedPayment || selectedGroup) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
            if (!processing) {
              setSelectedPayment(null);
              setSelectedGroup(null);
            }
          }}></div>
          <div className="relative w-full max-w-md rounded-2xl bg-cream p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate mb-4">
              {selectedGroup ? 'Process Total Payment' : 'Process Single Payment'}
            </h3>

            <div className="mb-6 rounded-xl bg-sand p-4 border border-gray-200">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-sage">Sahyogi Name</span>
                <span className="text-sm font-medium text-slate">
                  {selectedGroup ? selectedGroup.worker_name : selectedPayment?.worker_name}
                </span>
              </div>
              <div className="flex justify-between mb-4">
                <span className="text-sm text-sage">Phone</span>
                <span className="text-sm font-medium text-slate">
                  {selectedGroup ? selectedGroup.worker_phone : selectedPayment?.worker_phone}
                </span>
              </div>

              {selectedGroup && (
                <div className="flex justify-between mb-4 pt-3 border-t border-gray-200">
                  <span className="text-sm text-sage">Jobs Included</span>
                  <span className="text-sm font-medium text-slate bg-moss/10 text-moss px-2 py-0.5 rounded">
                    {selectedGroup.payments.length} Jobs
                  </span>
                </div>
              )}

              <div className="mb-4 rounded-lg bg-white p-3 border border-gray-100 flex justify-between items-center">
                <div>
                  <span className="block text-xs text-sage mb-1">UPI ID to Pay</span>
                  <span className="font-mono text-sm text-slate">
                    {selectedGroup ? selectedGroup.worker_upi_id : selectedPayment?.worker_upi_id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyUpi(selectedGroup ? selectedGroup.worker_upi_id : (selectedPayment?.worker_upi_id || ''))}
                  className="flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs font-medium text-moss hover:bg-gray-100 border border-gray-200"
                >
                  {copiedUpi === (selectedGroup ? selectedGroup.worker_upi_id : selectedPayment?.worker_upi_id) ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy</>
                  )}
                </button>
              </div>

              <div className="text-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <span className="block text-xs font-medium text-sage mb-1 uppercase tracking-wider">Amount to Pay</span>
                <span className="text-3xl font-bold text-slate">
                  {formatCurrency(selectedGroup ? selectedGroup.total_amount : (selectedPayment?.amount || 0))}
                </span>
              </div>
            </div>

            {processError && (
              <div className="mb-4 rounded-lg bg-clay/5 p-3 text-sm text-clay border border-clay/20">
                {processError}
              </div>
            )}

            <form onSubmit={handleProcessSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="utr" className="block text-sm font-medium text-slate mb-1">
                    UTR / Transaction Reference No. <span className="text-clay">*</span>
                  </label>
                  <input
                    type="text"
                    id="utr"
                    required
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 p-2.5 text-sm text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                    placeholder="Enter 12-digit UTR number"
                  />
                </div>
                <div>
                  <label htmlFor="remarks" className="block text-sm font-medium text-slate mb-1">
                    Remarks (Optional)
                  </label>
                  <textarea
                    id="remarks"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 p-2.5 text-sm text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                    placeholder={selectedGroup ? "Bulk payment processed..." : "Any notes..."}
                  ></textarea>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPayment(null);
                    setSelectedGroup(null);
                  }}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-slate hover:bg-gray-50 focus:outline-none disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing || !utrNumber}
                  className="flex-1 rounded-lg bg-moss px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
