import React, { useState, useEffect } from 'react';
import { Card, CardContent, Badge, Button } from './ui';
import { LogOut, Users, Store, Building2, MapPin, Phone, Mail, Plus, X, Briefcase, CheckCircle2, Circle, ClipboardList } from 'lucide-react';
import { assignedWorkers as initialWorkers, storeManagers as initialManagers, retailStores as initialStores, manpowerRequests as initialRequests, availableJobs } from '../data';
import { AssignedWorker, StoreManager, RetailStore, ManpowerRequest, Job } from '../types';

export function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [activeTab, setActiveTab] = useState<'workers' | 'managers' | 'stores' | 'requests'>('requests');
  
  // Local state for lists so we can update them when adding new items
  const [workers, setWorkers] = useState<AssignedWorker[]>(initialWorkers);
  const [managers, setManagers] = useState<StoreManager[]>(initialManagers);
  const [stores, setStores] = useState<RetailStore[]>(initialStores);
  const [requests, setRequests] = useState<ManpowerRequest[]>(initialRequests);

  // Sync requests whenever tab changes to requests
  useEffect(() => {
    if (activeTab === 'requests') {
      setRequests([...initialRequests]);
    }
  }, [activeTab]);

  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddStore, setShowAddStore] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<AssignedWorker | null>(null);

  // Form states
  const [userData, setUserData] = useState({
    firstName: '', lastName: '', phone: '', address: '', city: '', state: '', pinCode: '', role: 'worker', assignedStore: ''
  });
  const [storeData, setStoreData] = useState({
    name: '', location: '', city: '', state: '', pinCode: ''
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (userData.role === 'worker') {
      const newWorker: AssignedWorker = {
        id: `w-${Date.now()}`,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
        phone: userData.phone,
        photoUrl: `https://ui-avatars.com/api/?name=${userData.firstName}+${userData.lastName}&background=random`,
        jobTitle: 'New Worker',
        status: 'Review Pending',
        tasks: []
      };
      setWorkers([newWorker, ...workers]);
      setActiveTab('workers');
    } else {
      const newManager: StoreManager = {
        id: `m-${Date.now()}`,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
        phone: userData.phone,
        email: `${userData.firstName.toLowerCase()}@example.com`,
        store: userData.assignedStore || 'Unassigned'
      };
      setManagers([newManager, ...managers]);
      setActiveTab('managers');
    }
    setShowAddUser(false);
    setUserData({firstName: '', lastName: '', phone: '', address: '', city: '', state: '', pinCode: '', role: 'worker', assignedStore: ''});
  };

  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault();
    const newStore: RetailStore = {
      id: `rs-${Date.now()}`,
      name: storeData.name,
      location: `${storeData.location}, ${storeData.city}`,
      managerId: '',
      activeShifts: 0
    };
    setStores([newStore, ...stores]);
    setActiveTab('stores');
    setShowAddStore(false);
    setStoreData({name: '', location: '', city: '', state: '', pinCode: ''});
  };

  const promoteToManager = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    if (worker) {
      const newManager: StoreManager = {
        id: `m-${Date.now()}`,
        name: worker.name,
        phone: worker.phone,
        email: `${worker.name.split(' ')[0].toLowerCase()}@example.com`,
        store: 'Unassigned'
      };
      setManagers([newManager, ...managers]);
      setWorkers(workers.filter(w => w.id !== workerId));
      setSelectedWorker(null);
      setActiveTab('managers');
    }
  };

  const updateRequestStatus = (reqId: string, newStatus: 'Approved' | 'Rejected') => {
    const updated = requests.map(r => r.id === reqId ? { ...r, status: newStatus } : r);
    setRequests(updated);
    
    // Update the underlying shared array so Manager sees it if they switch back
    const target = initialRequests.find(r => r.id === reqId);
    if (target) {
      target.status = newStatus;
    }

    if (newStatus === 'Approved') {
      const reqToApprove = requests.find(r => r.id === reqId) || target;
      if (reqToApprove) {
        const existingJob = availableJobs.find(j => j.id === `job-req-${reqId}`);
        if (!existingJob) {
          const compNumber = parseFloat(reqToApprove.compensation) || 600;
          const newLiveJob: Job = {
            id: `job-req-${reqId}`,
            title: reqToApprove.role,
            retailer: reqToApprove.store.split('-')[0]?.trim() || reqToApprove.store,
            location: reqToApprove.store,
            distance: '1.5 km',
            date: reqToApprove.date || 'Today',
            time: `${reqToApprove.startTime || '9:00 AM'} - ${reqToApprove.endTime || '5:00 PM'}`,
            durationHours: 4,
            shiftType: 'Micro',
            payRate: Math.round(compNumber / 4),
            totalPay: compNumber,
            status: 'Available',
            tasks: [`Complete assigned tasks for ${reqToApprove.role}`, 'Report to store manager on arrival']
          };
          availableJobs.unshift(newLiveJob);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Admin Portal</h2>
          <p className="text-xs text-slate-500">System Overview</p>
        </div>
        <button 
          onClick={onSignOut}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-slate-200 bg-white px-2 overflow-x-auto no-scrollbar">
        <TabButton 
          active={activeTab === 'requests'} 
          onClick={() => setActiveTab('requests')}
          icon={<ClipboardList className="w-4 h-4 mr-1.5" />}
          label="Requests"
        />
        <TabButton 
          active={activeTab === 'workers'} 
          onClick={() => setActiveTab('workers')}
          icon={<Users className="w-4 h-4 mr-1.5" />}
          label="Workers"
        />
        <TabButton 
          active={activeTab === 'managers'} 
          onClick={() => setActiveTab('managers')}
          icon={<Store className="w-4 h-4 mr-1.5" />}
          label="Managers"
        />
        <TabButton 
          active={activeTab === 'stores'} 
          onClick={() => setActiveTab('stores')}
          icon={<Building2 className="w-4 h-4 mr-1.5" />}
          label="Stores"
        />
      </div>


      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'requests' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-700">No Pending Requests</h3>
                <p className="text-sm text-slate-500">Manpower requests from managers will appear here.</p>
              </div>
            ) : (
              requests.map(req => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800">{req.role}</h3>
                        <p className="text-xs text-slate-500 flex items-center mt-0.5">
                          <MapPin className="w-3 h-3 mr-1" /> {req.store}
                        </p>
                      </div>
                      <Badge variant={req.status === 'Pending Approval' ? 'warning' : req.status === 'Approved' ? 'success' : 'secondary'}>
                        {req.status === 'Approved' ? 'Published Live' : req.status}
                      </Badge>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2 border border-slate-100">
                      <div>
                        <span className="text-slate-500 text-xs block mb-0.5">Date</span>
                        <span className="font-medium text-slate-700">{req.date}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs block mb-0.5">Timing</span>
                        <span className="font-medium text-slate-700">{req.startTime} - {req.endTime}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs block mb-0.5">Workers Needed</span>
                        <span className="font-medium text-slate-700">{req.workersNeeded}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs block mb-0.5">Compensation</span>
                        <span className="font-medium text-brand-green">₹{req.compensation}</span>
                      </div>
                    </div>
                    
                    {req.status === 'Pending Approval' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex space-x-3">
                        <Button className="flex-1 text-xs h-8 bg-green-600 hover:bg-green-700" onClick={() => updateRequestStatus(req.id, 'Approved')}>Publish Live</Button>
                        <Button variant="outline" className="flex-1 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateRequestStatus(req.id, 'Rejected')}>Reject</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'workers' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {workers.map(worker => (
              <WorkerCard key={worker.id} worker={worker} onViewDetails={() => setSelectedWorker(worker)} />
            ))}
            {workers.length === 0 && <p className="text-center text-slate-500 mt-8">No active workers found.</p>}
          </div>
        )}

        {activeTab === 'managers' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {managers.map(manager => (
              <ManagerCard key={manager.id} manager={manager} />
            ))}
          </div>
        )}

        {activeTab === 'stores' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {stores.map(store => (
              <StoreCard key={store.id} store={store} managers={managers} />
            ))}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 h-[85%] flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Add New User</h3>
              <button onClick={() => setShowAddUser(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-800"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <form id="addUserForm" onSubmit={handleAddUser} className="space-y-4 pb-6">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Role</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button type="button" onClick={() => setUserData({...userData, role: 'worker'})} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${userData.role === 'worker' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Worker</button>
                    <button type="button" onClick={() => setUserData({...userData, role: 'manager'})} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${userData.role === 'manager' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Manager</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-xs font-medium text-slate-700">First Name</label><input required value={userData.firstName} onChange={e => setUserData({...userData, firstName: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="First" /></div>
                  <div className="space-y-1"><label className="text-xs font-medium text-slate-700">Last Name</label><input required value={userData.lastName} onChange={e => setUserData({...userData, lastName: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="Last" /></div>
                </div>
                <div className="space-y-1"><label className="text-xs font-medium text-slate-700">Phone</label><input required type="tel" value={userData.phone} onChange={e => setUserData({...userData, phone: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="+91 00000 00000" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-slate-700">Address</label><input required value={userData.address} onChange={e => setUserData({...userData, address: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="123 Street Name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-xs font-medium text-slate-700">City</label><input required value={userData.city} onChange={e => setUserData({...userData, city: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="City" /></div>
                  <div className="space-y-1"><label className="text-xs font-medium text-slate-700">State</label><input required value={userData.state} onChange={e => setUserData({...userData, state: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="State" /></div>
                </div>
                <div className="space-y-1"><label className="text-xs font-medium text-slate-700">PIN Code</label><input required value={userData.pinCode} onChange={e => setUserData({...userData, pinCode: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="000000" /></div>
                {userData.role === 'manager' && (
                  <div className="space-y-1"><label className="text-xs font-medium text-slate-700">Assigned Store</label><input required value={userData.assignedStore} onChange={e => setUserData({...userData, assignedStore: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="e.g. SuperMart - Downtown" /></div>
                )}
              </form>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <Button type="submit" form="addUserForm" className="w-full py-6">Create User</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Store Modal */}
      {showAddStore && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 h-[85%] flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Add New Store</h3>
              <button onClick={() => setShowAddStore(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-800"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <form id="addStoreForm" onSubmit={handleAddStore} className="space-y-4 pb-6">
                <div className="space-y-1"><label className="text-xs font-medium text-slate-700">Store Name</label><input required value={storeData.name} onChange={e => setStoreData({...storeData, name: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="SuperMart" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-slate-700">Location (Street/Area)</label><input required value={storeData.location} onChange={e => setStoreData({...storeData, location: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="Main Street" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-xs font-medium text-slate-700">City</label><input required value={storeData.city} onChange={e => setStoreData({...storeData, city: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="City" /></div>
                  <div className="space-y-1"><label className="text-xs font-medium text-slate-700">State</label><input required value={storeData.state} onChange={e => setStoreData({...storeData, state: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="State" /></div>
                </div>
                <div className="space-y-1"><label className="text-xs font-medium text-slate-700">PIN Code</label><input required value={storeData.pinCode} onChange={e => setStoreData({...storeData, pinCode: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue bg-white" placeholder="000000" /></div>
              </form>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <Button type="submit" form="addStoreForm" className="w-full py-6">Create Store</Button>
            </div>
          </div>
        </div>
      )}

      {/* Worker Details Modal */}
      {selectedWorker && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 h-[85%] flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-4">
                <img src={selectedWorker.photoUrl} alt={selectedWorker.name} className="w-16 h-16 rounded-full object-cover border border-slate-200 shadow-sm" />
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">{selectedWorker.name}</h3>
                  <Badge variant={selectedWorker.status === 'Working' ? 'primary' : 'secondary'} className="mt-1">
                    {selectedWorker.status}
                  </Badge>
                </div>
              </div>
              <button onClick={() => setSelectedWorker(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-800"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                <div className="flex items-center text-slate-700">
                  <Phone className="w-5 h-5 mr-3 text-slate-400" />
                  <span className="font-medium">{selectedWorker.phone}</span>
                </div>
                <div className="flex items-center text-slate-700">
                  <Briefcase className="w-5 h-5 mr-3 text-slate-400" />
                  <span className="font-medium">{selectedWorker.jobTitle}</span>
                </div>
              </div>

              {selectedWorker.tasks && selectedWorker.tasks.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center">
                    Current Shift Tasks
                  </h4>
                  <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-4">
                    {selectedWorker.tasks.map((task, idx) => (
                      <div key={idx} className="flex items-start">
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-brand-blue mr-3 shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 mr-3 shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {task.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 py-6 border-brand-purple text-brand-purple hover:bg-brand-purple/5"
                onClick={() => promoteToManager(selectedWorker.id)}
              >
                Promote to Manager
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-2 text-sm font-medium border-b-2 transition-colors ${
        active 
          ? 'border-brand-blue text-brand-blue' 
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      <span className="mt-0.5 text-xs">{label}</span>
    </button>
  );
}

function WorkerCard({ worker, onViewDetails }: { worker: AssignedWorker, onViewDetails: () => void }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <img src={worker.photoUrl} alt={worker.name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
            <div>
              <h3 className="font-semibold text-slate-800">{worker.name}</h3>
              <p className="text-xs text-slate-500 flex items-center mt-0.5">
                <Phone className="w-3 h-3 mr-1" /> {worker.phone}
              </p>
            </div>
          </div>
          <Badge variant={worker.status === 'Working' ? 'primary' : 'secondary'}>
            {worker.status}
          </Badge>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
          <span className="text-slate-600 font-medium">{worker.jobTitle}</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onViewDetails}>View Details</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagerCard({ manager }: { manager: StoreManager }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800">{manager.name}</h3>
            <p className="text-xs text-slate-500 flex items-center mt-1">
              <Store className="w-3 h-3 mr-1" /> {manager.store}
            </p>
          </div>
          <div className="w-10 h-10 bg-brand-blue/10 rounded-full flex items-center justify-center">
            <Store className="w-5 h-5 text-brand-blue" />
          </div>
        </div>
        <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 text-sm">
          <div className="flex items-center text-slate-600">
            <Phone className="w-4 h-4 mr-2 text-slate-400" /> {manager.phone}
          </div>
          <div className="flex items-center text-slate-600">
            <Mail className="w-4 h-4 mr-2 text-slate-400" /> {manager.email || 'N/A'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StoreCard({ store, managers }: { store: RetailStore, managers: StoreManager[] }) {
  const manager = managers.find(m => m.id === store.managerId);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800">{store.name}</h3>
            <p className="text-xs text-slate-500 flex items-center mt-1">
              <MapPin className="w-3 h-3 mr-1" /> {store.location}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-brand-purple">{store.activeShifts}</span>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Active Shifts</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Store Manager</p>
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
            <span className="text-sm font-medium text-slate-700">{manager?.name || 'Unassigned'}</span>
            <Button variant="text" size="sm" className="h-6 text-xs px-2">Contact</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
