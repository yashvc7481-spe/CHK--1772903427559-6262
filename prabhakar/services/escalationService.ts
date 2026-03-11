import { Grievance, GrievanceStatus, EscalationRecord, AdminLevel, SLAStatus } from '../types';
import { slaService } from './slaService';
import { workflowService } from './workflowService';
import { notificationService } from './notificationService';

const TERMINAL = new Set([GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED, GrievanceStatus.REJECTED]);

export const escalationService = {
  canCitizenEscalate(g: Grievance): boolean {
    if (TERMINAL.has(g.status)) return false;
    if (g.currentLevel >= AdminLevel.ADMIN) return false;
    const sla = slaService.computeSLA(g);
    return sla.status === SLAStatus.AT_RISK || sla.status === SLAStatus.BREACHED;
  },

  escalate(g: Grievance, reason: string, byName: string, byId?: string, allUsers: any[] = []): Grievance {
    const fromLevel = g.currentLevel;
    const toLevel = Math.min(fromLevel + 1, AdminLevel.ADMIN) as AdminLevel;
    const record: EscalationRecord = { id: Math.random().toString(36).substring(7), fromLevel, toLevel, reason, escalatedAt: Date.now(), escalatedByName: byName };
    const step = workflowService.makeStep(GrievanceStatus.ESCALATED, byName, byId, reason, !byId);
    allUsers.filter((u: any) => u.role === 'SUPERVISOR' || u.role === 'ADMIN').forEach((u: any) => {
      notificationService.createNotification(u.id, `Grievance #${g.ticketNumber} escalated: "${g.title}"`, 'ESCALATION', g.id);
    });
    notificationService.createNotification(g.citizenId, `Your grievance "${g.title}" (${g.ticketNumber}) has been escalated for urgent attention.`, 'ESCALATION', g.id);
    return { ...g, status: GrievanceStatus.ESCALATED, currentLevel: toLevel, escalations: [...g.escalations, record], workflow: [...g.workflow, step], updatedAt: Date.now() };
  },

  autoEscalateAll(grievances: Grievance[], allUsers: any[]): Grievance[] {
    return grievances.map(g => {
      if (TERMINAL.has(g.status) || g.status === GrievanceStatus.ESCALATED) return g;
      if (g.currentLevel >= AdminLevel.ADMIN) return g;
      if (slaService.computeSLA(g).status === SLAStatus.BREACHED)
        return this.escalate(g, 'Auto-escalated: SLA deadline exceeded', 'System', undefined, allUsers);
      return g;
    });
  },

  levelLabel(level: AdminLevel): string {
    return { [AdminLevel.OFFICER]: 'Field Officer', [AdminLevel.SUPERVISOR]: 'Department Supervisor', [AdminLevel.ADMIN]: 'Administration' }[level] ?? 'Unknown';
  },
};
