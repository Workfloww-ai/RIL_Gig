'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill out all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await changePassword(currentPassword, newPassword);
      setSuccess(res.data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-sand p-4 sm:p-8">
      <div className="mx-auto w-full max-w-md">
        <button 
          onClick={() => router.push('/finance')} 
          className="mb-6 flex items-center text-sm font-medium text-sage hover:text-moss transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </button>
        
        <div className="rounded-2xl bg-cream p-8 shadow-sm border border-gray-100">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate">Change Password</h1>
            <p className="mt-1 text-sm text-sage">Update your account security credentials</p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-clay/5 p-3 text-sm text-clay border border-clay/20">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-lg bg-moss/5 p-3 text-sm text-moss border border-moss/20">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-slate mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 p-2.5 text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                placeholder="Enter current password"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate mb-1.5">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 p-2.5 text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                placeholder="Enter new password"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 p-2.5 text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                placeholder="Confirm new password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-moss px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
