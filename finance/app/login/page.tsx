'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithPassword } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter both your identifier (email or mobile) and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await loginWithPassword(identifier, password);
      const { token, role } = res.data;

      if (role !== 'finance') {
        setError('Access denied. Finance role required.');
        setLoading(false);
        return;
      }

      localStorage.setItem('finance_token', token);
      router.push('/finance');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || (err.message === 'Network Error' ? 'Network or CORS error connecting to backend. Please check connection.' : err.message) || 'Invalid login credentials. Please try again.';
      setError(msg);
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
          <p className="mt-2 text-sm text-sage">Secure access to payment processing</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-clay/5 p-3 text-sm text-clay border border-clay/20">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
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
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate">
                Password
              </label>
              <a href="/forgot-password" className="text-xs text-sage hover:text-moss font-medium">
                Forgot Password?
              </a>
            </div>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 p-2.5 text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
              placeholder="Enter password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-moss px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
