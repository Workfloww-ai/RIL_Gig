/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { JobsList } from './components/JobsList';
import { ActiveShift } from './components/ActiveShift';
import { ManagerDashboard } from './components/ManagerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { mockUser, activeJob as initialActiveJob } from './data';
import { Job } from './types';
import { Home, Briefcase, PlayCircle, User, CheckCircle2, BookOpen } from 'lucide-react';
import { cn } from './components/ui';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'worker' | 'manager' | 'admin'>('worker');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'active' | 'profile' | 'training'>('dashboard');
  const [currentActiveJob, setCurrentActiveJob] = useState<Job | null>(initialActiveJob);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState(mockUser);
  const [mustCompleteTraining, setMustCompleteTraining] = useState(false);

  const handleLogin = (role: 'worker' | 'manager' | 'admin', userData?: any, isSignUp?: boolean) => {
    setUserRole(role);
    if (userData && (userData.firstName || userData.lastName)) {
       setCurrentUser({ 
         name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
         totalEarnings: 0,
         weeklyEarnings: 0,
         feedbackScore: 0,
         totalShifts: 0,
         isTopPerformer: false,
       });
    } else {
       setCurrentUser(mockUser);
    }
    
    if (isSignUp) {
      setMustCompleteTraining(true);
      setActiveTab('training');
    } else {
      setMustCompleteTraining(false);
      setActiveTab('dashboard');
    }
    
    setIsAuthenticated(true);
  };

  const handleBookJob = (job: Job) => {
    setCurrentActiveJob(job);
    setActiveTab('active');
  };

  const handleCompleteShift = () => {
    setCurrentActiveJob(null);
    setShowPaymentSuccess(true);
    setTimeout(() => {
      setShowPaymentSuccess(false);
      setActiveTab('dashboard');
    }, 3000);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <div className="w-full max-w-md h-[100dvh] sm:h-[850px] bg-white sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
          <Auth onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  if (userRole === 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <div className="w-full max-w-md h-[100dvh] sm:h-[850px] bg-surface sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
          <AdminDashboard onSignOut={() => setIsAuthenticated(false)} />
        </div>
      </div>
    );
  }

  if (userRole === 'manager') {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <div className="w-full max-w-md h-[100dvh] sm:h-[850px] bg-surface sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
          <ManagerDashboard onSignOut={() => setIsAuthenticated(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center items-center">
      <div className="w-full max-w-md h-[100dvh] sm:h-[850px] bg-surface sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-16">
          {activeTab === 'dashboard' && <Dashboard user={currentUser} />}
          {activeTab === 'jobs' && <JobsList onBook={handleBookJob} />}
          {activeTab === 'active' && <ActiveShift job={currentActiveJob} onComplete={handleCompleteShift} />}
          {activeTab === 'profile' && (
            <div className="p-6">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-24 h-24 bg-brand-purple/10 rounded-full flex items-center justify-center mb-4 shadow-sm border border-brand-purple/20">
                  <User className="w-12 h-12 text-brand-purple" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">{currentUser.name}</h2>
                <div className="flex items-center gap-1 mt-1 text-yellow-500 font-medium">
                  ★ {currentUser.feedbackScore} Rating
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-slate-50 rounded-xl">
                    <div className="text-xl font-bold text-slate-800">₹{currentUser.totalEarnings.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mt-1">Total Earnings</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl">
                    <div className="text-xl font-bold text-slate-800">{currentUser.totalShifts}</div>
                    <div className="text-xs text-slate-500 mt-1">Shifts Completed</div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsAuthenticated(false)}
                className="w-full py-4 text-brand-purple font-medium rounded-xl hover:bg-brand-purple/5 transition-colors border border-brand-purple/20 bg-white shadow-sm"
              >
                Sign Out
              </button>
            </div>
          )}
          {activeTab === 'training' && (
            <div className="p-6 h-full mt-8 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-brand-blue/10 rounded-full flex items-center justify-center mb-6 shadow-sm border border-brand-blue/20">
                <BookOpen className="w-10 h-10 text-brand-blue" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to the LUCID Training Module</h2>
              <p className="text-slate-500 mb-6 max-w-[280px]">
                Enhance your skills, learn standard operating procedures, and unlock higher-paying premium shifts.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full text-left mb-8 max-w-xs">
                <h4 className="font-bold text-slate-700 mb-3 text-sm">How it works:</h4>
                <ol className="text-sm text-slate-600 space-y-3 list-decimal pl-4">
                  <li className="pl-1">Click "Let's Start" to go to the LUCID platform.</li>
                  <li className="pl-1">Login with your email address and credentials.</li>
                  <li className="pl-1">Browse and complete the available training sprints.</li>
                </ol>
              </div>

              <button 
                onClick={() => window.open('https://lucid.workfloww.ai/', '_blank')}
                className="w-full max-w-xs py-4 bg-brand-blue text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors"
              >
                Let's Start
              </button>

              {mustCompleteTraining && (
                <button 
                  onClick={() => {
                    setMustCompleteTraining(false);
                    setActiveTab('dashboard');
                  }}
                  className="w-full max-w-xs mt-3 py-4 bg-white text-brand-blue font-bold rounded-xl border border-brand-blue shadow-sm hover:bg-slate-50 transition-colors"
                >
                  I've completed my training
                </button>
              )}
            </div>
          )}
        </div>

        {/* Payment Success Overlay */}
        {showPaymentSuccess && (
          <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Shift Completed!</h3>
              <p className="text-slate-500 mb-6">Great job. Your payment is being processed automatically and will hit your account shortly.</p>
            </div>
          </div>
        )}


        {/* Bottom Navigation */}
        {!mustCompleteTraining && (
          <div className="absolute bottom-0 w-full bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-40 pb-[env(safe-area-inset-bottom,12px)]">
            <NavItem 
              icon={<Home className="w-6 h-6" />} 
              label="Home" 
              isActive={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <NavItem 
              icon={<Briefcase className="w-6 h-6" />} 
              label="Jobs" 
              isActive={activeTab === 'jobs'} 
              onClick={() => setActiveTab('jobs')} 
            />
            <div className="relative -top-5">
              <button
                onClick={() => setActiveTab('active')}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95",
                  activeTab === 'active' 
                    ? "bg-brand-blue text-white" 
                    : currentActiveJob 
                      ? "bg-brand-purple text-white animate-pulse" 
                      : "bg-slate-100 text-slate-400"
                )}
              >
                <PlayCircle className="w-7 h-7" />
              </button>
            </div>
            <NavItem 
              icon={<User className="w-6 h-6" />} 
              label="Profile" 
              isActive={activeTab === 'profile'} 
              onClick={() => setActiveTab('profile')} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-16 transition-colors",
        isActive ? "text-brand-blue" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
