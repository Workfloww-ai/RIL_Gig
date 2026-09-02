'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendOtp, verifyOtp } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await sendOtp(`+91${mobile}`);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await verifyOtp(`+91${mobile}`, otp);
      const { token, role } = res.data;

      if (role !== 'finance') {
        setError('Access denied. Finance role required.');
        setLoading(false);
        return;
      }

      localStorage.setItem('finance_token', token);
      router.push('/finance');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid OTP. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-4">
      <div className="w-full max-w-md rounded-2xl bg-cream p-8 shadow-sm border border-gray-100">
        <div className="mb-8 text-center flex flex-col items-center">
          <img src="/images/logo.jpeg" alt="SahYogi Logo" className="h-16 w-16 object-contain rounded-xl shadow-sm mb-4 bg-white" />
          <h1 className="text-3xl font-bold text-moss">Sahyogi Finance</h1>
          <p className="mt-2 text-sm text-sage">Secure access to payment processing</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-clay/5 p-3 text-sm text-clay border border-clay/20">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div>
              <label htmlFor="mobile" className="block text-sm font-medium text-slate mb-2">
                Mobile Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 px-4 text-slate">
                  +91
                </span>
                <input
                  type="text"
                  id="mobile"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  className="block w-full min-w-0 flex-1 rounded-none rounded-r-lg border border-gray-200 p-2.5 text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                  placeholder="Enter 10-digit number"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-clay px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-clay/90 focus:outline-none focus:ring-4 focus:ring-clay/30 disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-slate mb-2">
                Enter OTP sent to +91 {mobile}
              </label>
              <input
                type="text"
                id="otp"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="block w-full rounded-lg border border-gray-200 p-2.5 text-center text-xl tracking-[0.5em] text-slate focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                placeholder="------"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-moss px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtp('');
                setError('');
              }}
              className="w-full text-sm text-sage hover:text-moss text-center"
            >
              Change mobile number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
