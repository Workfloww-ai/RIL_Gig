import React, { useState } from 'react';
import { Job } from '../types';
import { Card, CardContent, Button, Badge } from './ui';
import { Clock, MapPin, Map, Check } from 'lucide-react';

export function ActiveShift({ job, onComplete }: { job: Job | null, onComplete: () => void }) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [finishing, setFinishing] = useState(false);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Shift</h2>
        <p className="text-slate-500 max-w-xs">You don't have any shifts right now. Head over to the Jobs tab to find a new gig.</p>
      </div>
    );
  }

  const allTasksDone = completedTasks.length === (job.tasks?.length || 0);

  const toggleTask = (index: number) => {
    if (!checkedIn) return;
    setCompletedTasks(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleFinish = () => {
    setFinishing(true);
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-surface pb-20">
      <div className="bg-brand-blue pt-12 pb-6 px-4 rounded-b-3xl shadow-md text-white">
        <Badge variant="purple" className="bg-white/20 text-white border-none mb-3">Live Shift</Badge>
        <h2 className="text-2xl font-bold mb-1">{job.title}</h2>
        <p className="text-blue-100">{job.retailer}</p>
        
        <div className="mt-6 flex bg-white/10 rounded-xl p-3">
          <div className="flex-1">
            <p className="text-xs text-blue-200">Time</p>
            <p className="font-semibold text-sm">{job.time}</p>
          </div>
          <div className="w-px bg-white/20 mx-3"></div>
          <div className="flex-1">
            <p className="text-xs text-blue-200">Pay</p>
            <p className="font-semibold text-sm">₹{job.totalPay}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 -mt-4 z-10">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center text-sm font-medium text-slate-700">
              <MapPin className="w-5 h-5 text-slate-400 mr-2" />
              {job.location}
            </div>
            <Button variant="secondary" className="px-3 py-1 text-xs">
              <Map className="w-3 h-3 mr-1" /> Directions
            </Button>
          </CardContent>
        </Card>

        {!checkedIn ? (
          <Card className="border-brand-blue border-2">
            <CardContent className="text-center py-8">
              <div className="w-16 h-16 bg-surface-low rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-brand-blue" />
              </div>
              <h3 className="font-bold text-lg mb-2">You're at the location</h3>
              <p className="text-sm text-slate-500 mb-6">Check in to start your shift and view your task list.</p>
              <Button className="w-full py-3 text-lg" onClick={() => setCheckedIn(true)}>
                Check In Now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="px-1 pt-2 pb-1 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Task Checklist</h3>
              <span className="text-sm font-medium text-brand-blue">
                {completedTasks.length} / {job.tasks?.length || 0}
              </span>
            </div>
            <Card>
              <div className="divide-y divide-slate-100">
                {job.tasks?.map((task, idx) => {
                  const isDone = completedTasks.includes(idx);
                  return (
                    <div 
                      key={idx} 
                      className={`p-4 flex items-start cursor-pointer transition-colors ${isDone ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                      onClick={() => toggleTask(idx)}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 transition-colors ${isDone ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                        {isDone && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {task}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="pt-4">
              <Button 
                className="w-full py-3" 
                disabled={!allTasksDone || finishing}
                onClick={handleFinish}
              >
                {finishing ? 'Processing Payment...' : 'Finish Shift'}
              </Button>
              {!allTasksDone && (
                <p className="text-center text-xs text-slate-500 mt-2">
                  Complete all tasks to finish your shift.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
