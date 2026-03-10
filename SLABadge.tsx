import React from 'react';
import { SLAInfo, SLAStatus } from '../types';
import { slaService } from '../services/slaService';

interface Props { sla: SLAInfo; showTime?: boolean; showBar?: boolean; }

const CFG = {
  [SLAStatus.ON_TRACK]:  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/30', dot: 'bg-emerald-500', bar: 'bg-emerald-500', label: 'On Track' },
  [SLAStatus.AT_RISK]:   { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-900/30',   dot: 'bg-amber-500',   bar: 'bg-amber-500',   label: 'At Risk'  },
  [SLAStatus.BREACHED]:  { bg: 'bg-rose-50 dark:bg-rose-900/20',     text: 'text-rose-700 dark:text-rose-400',     border: 'border-rose-200 dark:border-rose-900/30',     dot: 'bg-rose-500 animate-pulse', bar: 'bg-rose-500', label: 'SLA Breached' },
  [SLAStatus.COMPLETED]: { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-700 dark:text-blue-400',     border: 'border-blue-200 dark:border-blue-900/30',     dot: 'bg-blue-500',    bar: 'bg-blue-500',    label: 'Completed' },
};

export const SLABadge: React.FC<Props> = ({ sla, showTime = false, showBar = false }) => {
  const c = CFG[sla.status];
  return (
    <div className="inline-flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
        {c.label}
        {showTime && sla.status !== SLAStatus.COMPLETED && (
          <span className="opacity-75 ml-0.5">· {slaService.formatDeadline(sla.hoursRemaining)}</span>
        )}
      </span>
      {showBar && (
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
            style={{ width: `${Math.min(sla.percentElapsed, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
