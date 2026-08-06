import React, { useState } from 'react';
import { Job, ShiftType } from '../types';
import { availableJobs } from '../data';
import { Card, CardContent, Badge, Button } from './ui';
import { MapPin, Clock, Calendar } from 'lucide-react';

export function JobsList({ onBook }: { onBook: (job: Job) => void }) {
  const [filter, setFilter] = useState<ShiftType | 'All'>('All');
  const [bookingJob, setBookingJob] = useState<string | null>(null);

  const filteredJobs = availableJobs.filter(
    (j) => filter === 'All' || j.shiftType === filter
  );

  const handleBook = (job: Job) => {
    setBookingJob(job.id);
    setTimeout(() => {
      onBook(job);
      setBookingJob(null);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Available Jobs</h2>
        <div className="flex space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {['All', 'Micro', 'Half Day', 'Full Day'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-brand-blue text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'Micro' ? 'Micro (<4h)' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-10 text-slate-500">No shifts available for this filter.</div>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.id} className="transition-all hover:shadow-md">
              <CardContent className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="purple" className="mb-2">{job.shiftType}</Badge>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{job.title}</h3>
                    <p className="text-sm font-medium text-slate-600">{job.retailer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-brand-blue">₹{job.totalPay}</p>
                    <p className="text-xs text-slate-500">₹{job.payRate}/hr</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                    <span>{job.date}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    <span>{job.time} ({job.durationHours}h)</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                    <span>{job.location} • {job.distance}</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => handleBook(job)}
                  disabled={bookingJob !== null}
                >
                  {bookingJob === job.id ? (
                    <span className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Booking...
                    </span>
                  ) : (
                    'Book Shift'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
