'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setError('Please enter your email or mobile number');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await forgotPassword(identifier);
      setMessage(res.data.message || 'If that account exists, a password reset link has been sent to its registered email.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-4">
      <div className="w-full max-w-md rounded-2xl bg-cream p-8 shadow-sm border border-gray-100">
        <div className="mb-8 text-center flex flex-col items-center">
          <img src="/images/newlogo.png" alt="SahYogi Logo" className="h-24 w-24 object-contain rounded-xl shadow-sm mb-4 bg-white" />
          <h1 className="text-3xl font-bold"><span style={{ color: '#0B5B31' }}>SahYogi</span> <span style={{ color: '#D32F2F' }}>Finance</span></h1>
          <p className="mt-2 text-sm text-sage">Reset your password</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-clay/5 p-3 text-sm text-clay border border-clay/20">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-lg bg-moss/5 p-3 text-sm text-moss border border-moss/20">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-slate mb-2">
              Email or Mobile Number
            </label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 p-2.5 text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
              placeholder="Enter email or mobile number"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-moss px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button onClick={() => router.push('/login')} className="text-sm font-medium text-sage hover:text-moss">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
