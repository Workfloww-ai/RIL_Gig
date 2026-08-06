export type ShiftType = 'Micro' | 'Half Day' | 'Full Day';

export interface Job {
  id: string;
  title: string;
  retailer: string;
  location: string;
  distance: string;
  date: string;
  time: string;
  durationHours: number;
  shiftType: ShiftType;
  payRate: number;
  totalPay: number;
  status: 'Available' | 'Booked' | 'Completed' | 'Active';
  tasks: string[];
}

export interface UserStats {
  name: string;
  totalEarnings: number;
  weeklyEarnings: number;
  feedbackScore: number;
  totalShifts: number;
  isTopPerformer: boolean;
}

export interface TaskStatus {
  description: string;
  completed: boolean;
}

export interface AssignedWorker {
  id: string;
  name: string;
  phone: string;
  photoUrl: string;
  jobTitle: string;
  status: 'Accepted' | 'En Route' | 'Working' | 'Review Pending' | 'Completed';
  eta?: string;
  tasks: TaskStatus[];
}

export interface StoreManager {
  id: string;
  name: string;
  store: string;
  phone: string;
  email: string;
}

export interface RetailStore {
  id: string;
  name: string;
  location: string;
  managerId: string;
  activeShifts: number;
}

export interface ManpowerRequest {
  id: string;
  store: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  workersNeeded: number;
  compensation: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected';
}
