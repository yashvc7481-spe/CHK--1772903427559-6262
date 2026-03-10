import React from 'react';
import { WorkflowStep, GrievanceStatus } from '../types';

interface Props { steps: WorkflowStep[]; }

const statusIcon = (s: GrievanceStatus, isLast: boolean): { bg: string; icon: React.ReactNode } => {
  if (s === GrievanceStatus.RESOLVED || s === GrievanceStatus.CLOSED)
    return { bg: 'bg-emerald-500', icon: <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> };
  if (s === GrievanceStatus.REJECTED)
    return { bg: 'bg-rose-500', icon: <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg> };
  if (s === GrievanceStatus.ESCALATED)
    return { bg: 'bg-orange-500', icon: <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> };
  if (isLast)
    return { bg: 'bg-indigo-500 animate-pulse', icon: <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" strokeWidth={2} /></svg> };
  return { bg: 'bg-blue-400', icon: <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /></svg> };
};

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const WorkflowTimeline: React.FC<Props> = ({ steps }) => {
  if (!steps?.length) return null;
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const { bg, icon } = statusIcon(step.status, isLast);
        return (
          <div key={step.id} className="flex gap-4">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${bg}`}>
                {icon}
              </div>
              {!isLast && <div className="w-0.5 flex-1 my-1 bg-gray-200 dark:bg-slate-700" />}
            </div>
            {/* Content */}
            <div className={`pb-5 flex-1 min-w-0 ${isLast ? '' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-sm font-semibold ${isLast ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-slate-300'}`}>{step.label}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {step.automated ? '🤖 ' : ''}{step.performedBy ?? 'System'}
                  </p>
                  {step.note && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 rounded-lg px-3 py-1.5 border border-gray-100 dark:border-slate-700">
                      {step.note}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">{timeAgo(step.timestamp)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
