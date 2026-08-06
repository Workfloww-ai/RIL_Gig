import React, { useState } from 'react';
import { Button, Card, CardContent } from './ui';
import { ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';

export function Auth({ onLogin }: { onLogin: (role: 'worker' | 'manager' | 'admin', userData?: any, isSignUp?: boolean) => void }) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState<'worker' | 'manager' | 'admin'>('worker');

  const [signUpData, setSignUpData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pinCode: ''
  });

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 1000);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onLogin(role, undefined, false);
    }, 1200);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onLogin('worker', signUpData, true);
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-surface h-full">
      <div className="w-full max-w-sm space-y-6 max-h-full overflow-y-auto no-scrollbar">
        <div className="text-center pt-4">
          <div className="mx-auto w-12 h-12 bg-brand-blue rounded-xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">LucidFlexi</h1>
        </div>
        
        {authMode === 'signin' && (
          <div className="flex bg-slate-100 p-1 rounded-[10px] mx-4 text-xs">
            <button 
              className={`flex-1 py-2 font-medium rounded-[6px] transition-colors ${role === 'worker' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
              onClick={() => setRole('worker')}
            >
              Worker
            </button>
            <button 
              className={`flex-1 py-2 font-medium rounded-[6px] transition-colors ${role === 'manager' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
              onClick={() => setRole('manager')}
            >
              Store Manager
            </button>
            <button 
              className={`flex-1 py-2 font-medium rounded-[6px] transition-colors ${role === 'admin' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
              onClick={() => setRole('admin')}
            >
              Admin
            </button>
          </div>
        )}
        
        <Card>
          <CardContent>
            {authMode === 'signin' ? (
              <>
                {step === 'phone' ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Phone Number</label>
                      <div className="relative flex items-center border border-slate-300 rounded-[8px] overflow-hidden focus-within:ring-2 focus-within:ring-brand-blue bg-white">
                        <div className="flex items-center px-3 bg-slate-50 border-r border-slate-300 py-2 h-full">
                          <span className="text-base mr-1 leading-none">🇮🇳</span>
                          <span className="text-sm font-medium text-slate-700">+91</span>
                        </div>
                        <input
                          required
                          type="tel"
                          pattern="[0-9]{10}"
                          placeholder="98765 43210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-3 pr-3 py-2 focus:outline-none text-slate-800"
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full mt-2" disabled={loading || phone.length < 10}>
                      {loading ? 'Sending OTP...' : 'Continue'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerify} className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">Enter OTP</label>
                        <button 
                          type="button" 
                          onClick={() => setStep('phone')}
                          className="text-xs text-brand-blue hover:underline flex items-center"
                        >
                          <ArrowLeft className="w-3 h-3 mr-1" /> Edit
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          required
                          autoFocus
                          type="text"
                          pattern="[0-9]*"
                          maxLength={6}
                          placeholder="••••••"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-brand-blue tracking-[0.5em] font-mono text-center text-lg bg-white"
                        />
                      </div>
                      <p className="text-xs text-slate-500 text-center mt-2">
                        Sent to +91 {phone}
                      </p>
                    </div>

                    <Button type="submit" className="w-full mt-2" disabled={loading || otp.length < 4}>
                      {loading ? 'Verifying...' : 'Sign In'}
                    </Button>
                  </form>
                )}
                
                <div className="mt-6 text-center">
                  <p className="text-sm text-slate-500">
                    Don't have an account?{' '}
                    <button 
                      onClick={() => setAuthMode('signup')}
                      className="text-brand-blue font-medium hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-slate-800">Create Account</h2>
                  <button 
                    type="button" 
                    onClick={() => setAuthMode('signin')}
                    className="text-xs text-brand-blue hover:underline flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" /> Back
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">First Name</label>
                    <input
                      required
                      type="text"
                      placeholder="Jane"
                      value={signUpData.firstName}
                      onChange={(e) => setSignUpData({...signUpData, firstName: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Last Name</label>
                    <input
                      required
                      type="text"
                      placeholder="Doe"
                      value={signUpData.lastName}
                      onChange={(e) => setSignUpData({...signUpData, lastName: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Phone Number</label>
                  <div className="relative flex items-center border border-slate-300 rounded-[8px] overflow-hidden focus-within:ring-2 focus-within:ring-brand-blue bg-white">
                    <div className="flex items-center px-3 bg-slate-50 border-r border-slate-300 py-2 h-full">
                      <span className="text-sm font-medium text-slate-700">+91</span>
                    </div>
                    <input
                      required
                      type="tel"
                      pattern="[0-9]{10}"
                      placeholder="98765 43210"
                      value={signUpData.phone}
                      onChange={(e) => setSignUpData({...signUpData, phone: e.target.value})}
                      className="w-full pl-3 pr-3 py-2 text-sm focus:outline-none text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Address</label>
                  <input
                    required
                    type="text"
                    placeholder="123 Main St, Apt 4"
                    value={signUpData.address}
                    onChange={(e) => setSignUpData({...signUpData, address: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">City</label>
                    <input
                      required
                      type="text"
                      placeholder="Mumbai"
                      value={signUpData.city}
                      onChange={(e) => setSignUpData({...signUpData, city: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">State</label>
                    <input
                      required
                      type="text"
                      placeholder="Maharashtra"
                      value={signUpData.state}
                      onChange={(e) => setSignUpData({...signUpData, state: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">PIN Code</label>
                  <input
                    required
                    type="text"
                    pattern="[0-9]{6}"
                    placeholder="400001"
                    value={signUpData.pinCode}
                    onChange={(e) => setSignUpData({...signUpData, pinCode: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
                  />
                </div>

                <Button type="submit" className="w-full mt-4" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
