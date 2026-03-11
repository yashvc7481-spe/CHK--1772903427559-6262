import { GrievanceStatus, WorkflowStep } from '../types';

const LABELS: Record<GrievanceStatus, string> = {
  [GrievanceStatus.SUBMITTED]:    'Grievance Submitted',
  [GrievanceStatus.PENDING]:      'Under Review',
  [GrievanceStatus.ACKNOWLEDGED]: 'Acknowledged by Officer',
  [GrievanceStatus.IN_PROGRESS]:  'Work In Progress',
  [GrievanceStatus.ESCALATED]:    'Escalated to Higher Authority',
  [GrievanceStatus.RESOLVED]:     'Issue Resolved',
  [GrievanceStatus.CLOSED]:       'Case Closed',
  [GrievanceStatus.REJECTED]:     'Grievance Rejected',
  [GrievanceStatus.REOPENED]:     'Case Reopened',
};

export const workflowService = {
  makeStep(status: GrievanceStatus, performer: string, performerId?: string, note?: string, automated = false): WorkflowStep {
    return { id: Math.random().toString(36).substring(7), status, label: LABELS[status] ?? status, performedBy: automated ? 'System (Automated)' : performer, performedById: performerId, note, timestamp: Date.now(), automated };
  },

  getLabel(s: GrievanceStatus): string { return LABELS[s] ?? s; },

  getAllowedTransitions(status: GrievanceStatus, role: string): GrievanceStatus[] {
    const isStaff = ['OFFICER', 'SUPERVISOR', 'ADMIN'].includes(role);
    switch (status) {
      case GrievanceStatus.SUBMITTED:
      case GrievanceStatus.PENDING:
        return isStaff ? [GrievanceStatus.ACKNOWLEDGED, GrievanceStatus.REJECTED] : [];
      case GrievanceStatus.ACKNOWLEDGED:
        return isStaff ? [GrievanceStatus.IN_PROGRESS, GrievanceStatus.REJECTED] : [];
      case GrievanceStatus.IN_PROGRESS:
        return isStaff ? [GrievanceStatus.RESOLVED, GrievanceStatus.ESCALATED] : [];
      case GrievanceStatus.ESCALATED:
        return isStaff ? [GrievanceStatus.IN_PROGRESS, GrievanceStatus.RESOLVED, GrievanceStatus.REJECTED] : [];
      case GrievanceStatus.RESOLVED:
        if (role === 'CITIZEN') return [GrievanceStatus.REOPENED];
        return isStaff ? [GrievanceStatus.CLOSED] : [];
      case GrievanceStatus.REOPENED:
        return isStaff ? [GrievanceStatus.ACKNOWLEDGED, GrievanceStatus.IN_PROGRESS] : [];
      default: return [];
    }
  },
};
