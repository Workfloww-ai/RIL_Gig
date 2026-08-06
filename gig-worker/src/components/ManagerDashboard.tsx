import React, { useState } from 'react';
import { assignedWorkers, mockManager, manpowerRequests } from '../data';
import { Card, CardContent, Button, Badge, cn } from './ui';
import { Check, Clock, MessageSquare, Star, Users, Briefcase, Home, History, User, BarChart3, TrendingUp, X, ClipboardList } from 'lucide-react';
import { AssignedWorker } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const trendData = [
  { name: 'Mon', hours: 12, cost: 2400 },
  { name: 'Tue', hours: 15, cost: 3000 },
  { name: 'Wed', hours: 22, cost: 4400 },
  { name: 'Thu', hours: 18, cost: 3600 },
  { name: 'Fri', hours: 25, cost: 5000 },
  { name: 'Sat', hours: 32, cost: 6400 },
  { name: 'Sun', hours: 28, cost: 5600 },
];

const projectedData = [
  { name: 'Week 1', projected: 120, estimatedCost: 24000 },
  { name: 'Week 2', projected: 140, estimatedCost: 28000 },
  { name: 'Week 3', projected: 130, estimatedCost: 26000 },
  { name: 'Week 4', projected: 150, estimatedCost: 30000 },
];

const ROLE_OPTIONS = [
  { role: 'Inventory Restocking Associate', compensation: '800' },
  { role: 'Curbside Pickup Assistant', compensation: '1000' },
  { role: 'Weekend Floor Associate', compensation: '1200' },
  { role: 'Cashier / Billing Specialist', compensation: '650' },
  { role: 'Customer Experience Helper', compensation: '750' },
  { role: 'Morning Display Setup', compensation: '700' },
  { role: 'Store Logistics & Unloading', compensation: '900' },
];

function calculateEndTime(startTimeStr: string, durationHours: number): string {
  if (!startTimeStr) return '';
  const [hStr, mStr] = startTimeStr.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return '';
  
  let endH = (h + durationHours) % 24;
  let period = endH >= 12 ? 'PM' : 'AM';
  let displayH = endH % 12;
  if (displayH === 0) displayH = 12;
  let displayM = m < 10 ? `0${m}` : `${m}`;
  
  return `${displayH}:${displayM} ${period}`;
}

export function ManagerDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [workers, setWorkers] = useState<AssignedWorker[]>(assignedWorkers);
  const [selectedWorker, setSelectedWorker] = useState<AssignedWorker | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'insights' | 'requests' | 'history' | 'profile'>('home');
  const [showRaiseRequest, setShowRaiseRequest] = useState(false);
  const [myRequests, setMyRequests] = useState(() => manpowerRequests.filter(r => r.store === mockManager.store));
  const [requestData, setRequestData] = useState({
    store: mockManager.store,
    date: '',
    startTime: '',
    durationHours: 4,
    role: '',
    workersNeeded: 1,
    compensation: ''
  });

  const pendingCount = workers.filter(w => w.status === 'Review Pending').length;
  const activeCount = workers.filter(w => w.status === 'Working' || w.status === 'En Route').length;

  const handleApprove = (id: string) => {
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, status: 'Completed' } : w));
    setSelectedWorker(null);
  };

  const handlePublishJob = (e: React.FormEvent) => {
    e.preventDefault();
    
    let formattedStart = requestData.startTime;
    if (requestData.startTime && requestData.startTime.includes(':')) {
      const [hStr, mStr] = requestData.startTime.split(':');
      let h = parseInt(hStr, 10);
      let period = h >= 12 ? 'PM' : 'AM';
      let displayH = h % 12;
      if (displayH === 0) displayH = 12;
      formattedStart = `${displayH}:${mStr} ${period}`;
    }

    const calculatedEndTime = calculateEndTime(requestData.startTime, requestData.durationHours);

    const newReq: any = {
      id: `req-${Date.now()}`,
      store: requestData.store,
      date: requestData.date,
      startTime: formattedStart,
      endTime: calculatedEndTime || `${requestData.durationHours} hrs`,
      role: requestData.role,
      workersNeeded: requestData.workersNeeded,
      compensation: requestData.compensation,
      status: 'Pending Approval'
    };

    manpowerRequests.unshift(newReq);
    setMyRequests([newReq, ...myRequests]);

    alert(`Success! Request for ${requestData.workersNeeded} ${requestData.role}(s) at ${requestData.store} (${requestData.durationHours} hours) has been sent to Admin for approval.`);
    setShowRaiseRequest(false);
    setRequestData({ ...requestData, date: '', startTime: '', durationHours: 4, role: '', workersNeeded: 1, compensation: '' });
  };

  // Re-fetch myRequests when tab is switched in case admin approved it while logged in (or on mount)
  React.useEffect(() => {
    if (activeTab === 'requests') {
      setMyRequests([...manpowerRequests.filter(r => r.store === mockManager.store)]);
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full bg-surface relative">
      <div className="bg-brand-blue pt-10 pb-6 px-4 rounded-b-3xl shadow-md text-white z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Hi, {mockManager.name}</h2>
            <p className="text-blue-100 text-sm">{mockManager.store}</p>
          </div>
          <button 
            onClick={onSignOut}
            className="text-xs bg-white/20 px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
          >
            Sign Out
          </button>
        </div>
        
        <div className="flex bg-white/10 rounded-xl p-3 mt-4">
          <div className="flex-1 flex flex-col items-center">
            <Users className="w-5 h-5 text-blue-200 mb-1" />
            <p className="font-bold text-lg">{activeCount}</p>
            <p className="text-xs text-blue-200">Active</p>
          </div>
          <div className="w-px bg-white/20 mx-3"></div>
          <div className="flex-1 flex flex-col items-center">
            <Check className="w-5 h-5 text-blue-200 mb-1" />
            <p className="font-bold text-lg">{pendingCount}</p>
            <p className="text-xs text-blue-200">Pending Review</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 -mt-4 z-0 flex-1 overflow-y-auto pb-24 pt-8">
        
        {activeTab === 'home' && (
          <>
            <div className="flex justify-between items-center mb-4 mt-2">
              <h3 className="font-bold text-slate-800 ml-1">Today's Gig Workers</h3>
              <Button size="sm" className="h-8 text-xs px-3" onClick={() => setShowRaiseRequest(true)}>
                + Raise Request
              </Button>
            </div>
            
            {workers.map(worker => (
              <Card key={worker.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedWorker(worker)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <img src={worker.photoUrl} alt={worker.name} className="w-12 h-12 rounded-full border border-slate-200" />
                      <div>
                        <h4 className="font-bold text-slate-800">{worker.name}</h4>
                        <p className="text-xs text-slate-500">{worker.jobTitle}</p>
                      </div>
                    </div>
                    <Badge variant={worker.status === 'Review Pending' ? 'warning' : worker.status === 'Completed' ? 'success' : 'purple'}>
                      {worker.status}
                    </Badge>
                  </div>
                  
                  {worker.status === 'En Route' && worker.eta && (
                    <div className="mt-3 flex items-center text-xs text-slate-600 bg-slate-50 p-2 rounded">
                      <Clock className="w-3 h-3 mr-1.5 text-brand-blue" />
                      Arriving in <span className="font-bold ml-1">{worker.eta}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 ml-1">My Requests</h3>
              <Button size="sm" className="h-8 text-xs px-3 bg-brand-blue" onClick={() => setShowRaiseRequest(true)}>
                + New Request
              </Button>
            </div>
            
            {myRequests.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-700">No Requests</h3>
                <p className="text-sm text-slate-500">You haven't raised any manpower requests yet.</p>
              </div>
            ) : (
              myRequests.map(req => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800">{req.role}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{req.date} • {req.startTime} to {req.endTime}</p>
                      </div>
                      <Badge variant={req.status === 'Pending Approval' ? 'warning' : req.status === 'Approved' ? 'success' : 'secondary'}>
                        {req.status}
                      </Badge>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between border border-slate-100">
                      <div>
                        <span className="text-slate-500 text-xs block mb-0.5">Workers</span>
                        <span className="font-medium text-slate-700">{req.workersNeeded} Needed</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 text-xs block mb-0.5">Compensation</span>
                        <span className="font-medium text-brand-green">₹{req.compensation}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-800 ml-1 mb-3">Deployment Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <Clock className="w-6 h-6 text-brand-blue mb-2" />
                    <p className="text-2xl font-bold text-slate-800">152</p>
                    <p className="text-xs text-slate-500 font-medium">Hours This Week</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="w-6 h-6 text-green-500 mb-2" />
                    <p className="text-2xl font-bold text-slate-800">₹30.4k</p>
                    <p className="text-xs text-slate-500 font-medium">Total Cost</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800 text-sm">Hours Trend (This Week)</h4>
                  <Badge variant="default" className="text-[10px]">Weekly</Badge>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                      />
                      <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800 text-sm">Projected Needs (Next Month)</h4>
                  <Badge variant="purple" className="text-[10px]">Forecast</Badge>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectedData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Bar dataKey="projected" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Hours" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-500 font-medium">Estimated Budget</p>
                    <p className="text-lg font-bold text-slate-800">₹1,08,000</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h4 className="font-bold text-slate-800 text-sm mb-4">Deployment Log (Recent)</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Today, 2:00 PM - 5:00 PM</p>
                      <p className="text-xs text-slate-500">3 Hours • Inventory Restocking</p>
                    </div>
                    <Badge variant="success">Completed</Badge>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Today, 6:00 AM - 9:00 AM</p>
                      <p className="text-xs text-slate-500">3 Hours • Display Setup</p>
                    </div>
                    <Badge variant="success">Completed</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Yesterday, 9:00 AM - 5:00 PM</p>
                      <p className="text-xs text-slate-500">8 Hours • Weekend Floor Associate</p>
                    </div>
                    <Badge variant="success">Completed</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">Past Shifts</h3>
            <p className="text-sm text-slate-500">History will appear here once shifts are completed.</p>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">{mockManager.name}</h3>
            <p className="text-sm text-slate-500">{mockManager.store}</p>
          </div>
        )}

      </div>

      {selectedWorker && activeTab === 'home' && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 h-[85%] overflow-y-auto flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-4">
                <img src={selectedWorker.photoUrl} alt={selectedWorker.name} className="w-16 h-16 rounded-full border-2 border-brand-blue" />
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedWorker.name}</h3>
                  <p className="text-sm text-slate-500 flex items-center">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 mr-1" />
                    4.9 Rating • 42 Shifts
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedWorker(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 flex-1">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Job Details</h4>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center">
                  <Briefcase className="w-5 h-5 text-brand-blue mr-3" />
                  <div>
                    <p className="font-medium text-sm">{selectedWorker.jobTitle}</p>
                    <p className="text-xs text-slate-500">Shift ID: {selectedWorker.id.toUpperCase()}-093</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-slate-800">Task Checklist</h4>
                  <span className="text-xs font-medium text-brand-blue">
                    {selectedWorker.tasks.filter(t => t.completed).length} / {selectedWorker.tasks.length} Done
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedWorker.tasks.map((task, idx) => (
                    <div key={idx} className="flex items-start text-sm">
                      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center mr-2 flex-shrink-0 ${task.completed ? 'bg-green-500' : 'bg-slate-200'}`}>
                        {task.completed && <Check className="w-2.5 h-2.5 text-white" /> }
                      </div>
                      <span className={task.completed ? 'text-slate-600' : 'text-slate-400'}>{task.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedWorker.status === 'Review Pending' && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Provide Feedback</h4>
                  <div className="flex space-x-2 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star}>
                        <Star className={`w-8 h-8 ${star === 5 ? 'text-slate-300' : 'text-amber-500 fill-amber-500'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea 
                    className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-blue" 
                    rows={3}
                    placeholder={`Add a note about ${selectedWorker.name}'s performance...`}
                    defaultValue="Excellent job. Finished tasks quickly and efficiently."
                  />
                </div>
              )}
            </div>

            <div className="pt-4 pb-[env(safe-area-inset-bottom,12px)]">
              {selectedWorker.status === 'Review Pending' ? (
                <Button className="w-full py-3" onClick={() => handleApprove(selectedWorker.id)}>
                  Approve & Submit Payment
                </Button>
              ) : selectedWorker.status === 'En Route' ? (
                <Button variant="secondary" className="w-full py-3">
                  <MessageSquare className="w-4 h-4 mr-2" /> Message Worker
                </Button>
              ) : (
                <Button variant="outline" className="w-full py-3" onClick={() => setSelectedWorker(null)}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Raise Request Modal */}
      {showRaiseRequest && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 h-[85%] flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Raise Manpower Request</h3>
              <button onClick={() => setShowRaiseRequest(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-800"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <form id="raiseRequestForm" onSubmit={handlePublishJob} className="space-y-4 pb-6">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Store</label>
                  <input readOnly value={requestData.store} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-500 font-medium" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Date</label>
                    <input required type="date" value={requestData.date} onChange={e => setRequestData({...requestData, date: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Role</label>
                    <select 
                      required 
                      value={requestData.role} 
                      onChange={e => {
                        const selectedRole = e.target.value;
                        const matched = ROLE_OPTIONS.find(r => r.role === selectedRole);
                        setRequestData({
                          ...requestData,
                          role: selectedRole,
                          compensation: matched ? matched.compensation : ''
                        });
                      }} 
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white"
                    >
                      <option value="" disabled>Select a role...</option>
                      {ROLE_OPTIONS.map(opt => (
                        <option key={opt.role} value={opt.role}>
                          {opt.role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Start Time</label>
                    <input required type="time" value={requestData.startTime} onChange={e => setRequestData({...requestData, startTime: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">How many hours?</label>
                    <input 
                      required 
                      type="number" 
                      min="1" 
                      max="12" 
                      placeholder="e.g. 4" 
                      value={requestData.durationHours} 
                      onChange={e => setRequestData({...requestData, durationHours: parseInt(e.target.value) || 1})} 
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Number of Workers</label>
                    <input required type="number" min="1" value={requestData.workersNeeded} onChange={e => setRequestData({...requestData, workersNeeded: parseInt(e.target.value)})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Compensation (Fixed ₹)</label>
                    <input readOnly required placeholder="Auto-set by role" value={requestData.compensation ? `₹${requestData.compensation}` : ''} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-not-allowed" />
                  </div>
                </div>
              </form>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <Button type="submit" form="raiseRequestForm" className="w-full py-6">Publish to Worker Pool</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 w-full bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-40 pb-[env(safe-area-inset-bottom,12px)]">
        <NavItem 
          icon={<Home className="w-6 h-6" />} 
          label="Home" 
          isActive={activeTab === 'home'} 
          onClick={() => setActiveTab('home')} 
        />
        <NavItem 
          icon={<ClipboardList className="w-6 h-6" />} 
          label="Requests" 
          isActive={activeTab === 'requests'} 
          onClick={() => setActiveTab('requests')} 
        />
        <NavItem 
          icon={<BarChart3 className="w-6 h-6" />} 
          label="Insights" 
          isActive={activeTab === 'insights'} 
          onClick={() => setActiveTab('insights')} 
        />
        <NavItem 
          icon={<User className="w-6 h-6" />} 
          label="Profile" 
          isActive={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')} 
        />
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-14 transition-colors",
        isActive ? "text-brand-blue" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
