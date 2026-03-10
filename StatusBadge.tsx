import React from 'react';
import { GrievanceStatus } from '../types';

const CONFIG: Record<GrievanceStatus, { bg: string; text: string; border: string; dot: string }> = {
  [GrievanceStatus.SUBMITTED]:    { bg: 'bg-gray-50 dark:bg-gray-900/20',   text: 'text-gray-600 dark:text-gray-400',   border: 'border-gray-200 dark:border-gray-700',   dot: 'bg-gray-400' },
  [GrievanceStatus.PENDING]:      { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-900/30', dot: 'bg-amber-500' },
  [GrievanceStatus.ACKNOWLEDGED]: { bg: 'bg-sky-50 dark:bg-sky-900/20',     text: 'text-sky-700 dark:text-sky-400',     border: 'border-sky-100 dark:border-sky-900/30',   dot: 'bg-sky-500' },
  [GrievanceStatus.IN_PROGRESS]:  { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-400',   border: 'border-blue-100 dark:border-blue-900/30', dot: 'bg-blue-500' },
  [GrievanceStatus.ESCALATED]:    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-100 dark:border-orange-900/30', dot: 'bg-orange-500 animate-pulse' },
  [GrievanceStatus.RESOLVED]:     { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-900/30', dot: 'bg-emerald-500' },
  [GrievanceStatus.CLOSED]:       { bg: 'bg-teal-50 dark:bg-teal-900/20',   text: 'text-teal-700 dark:text-teal-400',   border: 'border-teal-100 dark:border-teal-900/30', dot: 'bg-teal-500' },
  [GrievanceStatus.REJECTED]:     { bg: 'bg-rose-50 dark:bg-rose-900/20',   text: 'text-rose-700 dark:text-rose-400',   border: 'border-rose-100 dark:border-rose-900/30', dot: 'bg-rose-500' },
  [GrievanceStatus.REOPENED]:     { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-100 dark:border-violet-900/30', dot: 'bg-violet-500' },
};

export const StatusBadge: React.FC<{ status: GrievanceStatus }> = ({ status }) => {
  const c = CONFIG[status] ?? CONFIG[GrievanceStatus.PENDING];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
