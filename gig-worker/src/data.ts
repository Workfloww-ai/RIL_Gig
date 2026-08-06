import { Job, UserStats, AssignedWorker, StoreManager, RetailStore } from './types';

export const mockUser: UserStats = {
  name: 'Monalika Goel',
  totalEarnings: 34500.00,
  weeklyEarnings: 4250.50,
  feedbackScore: 4.9,
  totalShifts: 42,
  isTopPerformer: true,
};

export const mockManager: StoreManager = {
  id: 'm-1',
  name: 'Rajesh Kumar',
  store: 'Reliance Smart - Phoenix Marketcity',
  phone: '+91 98765 12345',
  email: 'rajesh.k@reliancesmart.com',
};

export const storeManagers: StoreManager[] = [
  mockManager,
  {
    id: 'm-2',
    name: 'Anita Sharma',
    store: 'Croma - Linking Road',
    phone: '+91 98765 54321',
    email: 'anita.s@croma.com',
  },
  {
    id: 'm-3',
    name: 'Vikram Singh',
    store: 'Shoppers Stop - Inorbit Mall',
    phone: '+91 98765 67890',
    email: 'vikram.s@shoppersstop.com',
  }
];

export const retailStores: RetailStore[] = [
  {
    id: 'rs-1',
    name: 'Reliance Smart',
    location: 'Phoenix Marketcity, Kurla',
    managerId: 'm-1',
    activeShifts: 4,
  },
  {
    id: 'rs-2',
    name: 'Croma',
    location: 'Linking Road, Bandra',
    managerId: 'm-2',
    activeShifts: 2,
  },
  {
    id: 'rs-3',
    name: 'Shoppers Stop',
    location: 'Inorbit Mall, Malad',
    managerId: 'm-3',
    activeShifts: 5,
  }
];

export const assignedWorkers: AssignedWorker[] = [
  {
    id: 'w-1',
    name: 'Monalika Goel',
    phone: '+91 98765 43210',
    photoUrl: 'https://i.pravatar.cc/150?u=monalika',
    jobTitle: 'Inventory Restocking',
    status: 'Review Pending',
    tasks: [
      { description: 'Scan low-stock items', completed: true },
      { description: 'Unload pallet from backroom', completed: true },
      { description: 'Restock shelves 1-12', completed: true },
      { description: 'Clear empty cardboard', completed: true },
    ]
  },
  {
    id: 'w-2',
    name: 'Priya',
    phone: '+91 87654 32109',
    photoUrl: 'https://i.pravatar.cc/150?u=priya',
    jobTitle: 'Morning Display Setup',
    status: 'En Route',
    eta: '15 mins',
    tasks: [
      { description: 'Check in with Store Manager', completed: false },
      { description: 'Setup front entrance fruit display', completed: false },
    ]
  }
];

export const availableJobs: Job[] = [
  {
    id: 'job-1',
    title: 'Inventory Restocking',
    retailer: 'Reliance Smart',
    location: 'Phoenix Marketcity, Kurla',
    distance: '1.2 km',
    date: 'Today',
    time: '2:00 PM - 5:00 PM',
    durationHours: 3,
    shiftType: 'Micro',
    payRate: 200,
    totalPay: 600,
    status: 'Available',
    tasks: ['Scan low-stock items', 'Unload pallet from backroom', 'Restock shelves 1-12', 'Clear empty cardboard'],
  },
  {
    id: 'job-2',
    title: 'Curbside Pickup Assistant',
    retailer: 'Croma',
    location: 'Linking Road, Bandra',
    distance: '3.5 km',
    date: 'Tomorrow',
    time: '8:00 AM - 1:00 PM',
    durationHours: 5,
    shiftType: 'Half Day',
    payRate: 250,
    totalPay: 1250,
    status: 'Available',
    tasks: ['Check-in customers', 'Retrieve orders from staging', 'Load items into vehicles', 'Collect customer signatures'],
  },
  {
    id: 'job-3',
    title: 'Weekend Floor Associate',
    retailer: 'Shoppers Stop',
    location: 'Inorbit Mall, Malad',
    distance: '5.0 km',
    date: 'Saturday',
    time: '9:00 AM - 5:00 PM',
    durationHours: 8,
    shiftType: 'Full Day',
    payRate: 220,
    totalPay: 1760,
    status: 'Available',
    tasks: ['Greet customers', 'Organize apparel tables', 'Manage fitting room returns', 'Assist at cash wrap'],
  }
];

export const activeJob: Job = {
  id: 'job-0',
  title: 'Morning Display Setup',
  retailer: 'DMart',
  location: 'Andheri West, Near Metro',
  distance: '0.8 km',
  date: 'Today',
  time: '6:00 AM - 9:00 AM',
  durationHours: 3,
  shiftType: 'Micro',
  payRate: 250,
  totalPay: 750,
  status: 'Active',
  tasks: ['Check in with Store Manager', 'Setup front entrance fruit display', 'Update price tags for organic section', 'Submit photo of completed display'],
};

export const manpowerRequests: import('./types').ManpowerRequest[] = [
  {
    id: 'req-1',
    store: 'Reliance Smart - Phoenix Marketcity',
    date: 'Today',
    startTime: '2:00 PM',
    endTime: '6:00 PM',
    role: 'Inventory Restocking Associate',
    workersNeeded: 2,
    compensation: '800',
    status: 'Pending Approval'
  },
  {
    id: 'req-2',
    store: 'Croma - Linking Road',
    date: 'Tomorrow',
    startTime: '10:00 AM',
    endTime: '4:00 PM',
    role: 'Customer Experience Helper',
    workersNeeded: 1,
    compensation: '1200',
    status: 'Pending Approval'
  }
];
