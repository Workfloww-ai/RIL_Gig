import React from 'react';
import { UserStats } from '../types';
import { Card, CardContent, Badge, Button } from './ui';
import { IndianRupee, TrendingUp, Star, Bell } from 'lucide-react';

export function Dashboard({ user }: { user: UserStats }) {
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Hello, {user.name.split(' ')[0]}</h2>
          <p className="text-slate-500 text-sm">Certified Member</p>
        </div>
        <button className="relative p-2 bg-white rounded-full shadow-sm border border-slate-200">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="col-span-2">
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Earnings</p>
              <h3 className="text-3xl font-bold text-slate-800">₹{user.totalEarnings.toLocaleString('en-IN', {minimumFractionDigits: 2})}</h3>
              {user.totalEarnings > 0 && (
                <div className="flex items-center text-green-600 text-xs mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span>+12.5% this month</span>
                </div>
              )}
            </div>
            <div className="h-12 w-12 bg-surface-low rounded-full flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-brand-blue" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium text-slate-500 mb-1">This Week</p>
            <h4 className="text-xl font-bold text-slate-800">₹{user.weeklyEarnings.toFixed(2)}</h4>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Feedback Score</p>
            <div className="flex items-center space-x-1">
              <h4 className="text-xl font-bold text-slate-800">{user.feedbackScore}</h4>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500 mb-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Recent Activity</h3>
          <Button variant="text" className="text-sm">View all</Button>
        </div>
        <Card>
          {user.totalShifts === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No recent activity
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-slate-800">Payment Processed</p>
                    <p className="text-xs text-slate-500">Inventory Restocking • {i}d ago</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm text-green-600">+₹640.00</p>
                    <p className="text-xs text-slate-400">Automated transfer</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
