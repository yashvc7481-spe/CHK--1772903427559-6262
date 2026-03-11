import { Grievance, Priority, SLAInfo, SLAStatus, GrievanceStatus } from '../types';

interface SLAConfig { acknowledgeHours: number; resolutionHours: number; }

const SLA_TABLE: Record<Priority, SLAConfig> = {
  [Priority.CRITICAL]: { acknowledgeHours: 1,  resolutionHours: 4   },
  [Priority.HIGH]:     { acknowledgeHours: 4,  resolutionHours: 24  },
  [Priority.MEDIUM]:   { acknowledgeHours: 8,  resolutionHours: 72  },
  [Priority.LOW]:      { acknowledgeHours: 24, resolutionHours: 168 },
};

const TERMINAL = new Set([GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED, GrievanceStatus.REJECTED]);
const H = 3_600_000;

export const slaService = {
  computeSLA(g: Grievance): SLAInfo {
    const cfg = SLA_TABLE[g.priority] ?? SLA_TABLE[Priority.MEDIUM];
    const deadline = g.createdAt + cfg.resolutionHours * H;
    const acknowledgeDeadline = g.createdAt + cfg.acknowledgeHours * H;
    const now = Date.now();
    const elapsed = (now - g.createdAt) / H;
    const hoursRemaining = (deadline - now) / H;
    const percentElapsed = Math.min(100, Math.round((elapsed / cfg.resolutionHours) * 100));
    let status: SLAStatus;
    if (TERMINAL.has(g.status))          status = SLAStatus.COMPLETED;
    else if (now > deadline)              status = SLAStatus.BREACHED;
    else if (percentElapsed >= 75)        status = SLAStatus.AT_RISK;
    else                                  status = SLAStatus.ON_TRACK;
    return { status, deadline, acknowledgeDeadline, hoursRemaining, percentElapsed };
  },

  formatDeadline(hours: number): string {
    const abs = Math.abs(hours);
    if (hours < 0)  return `${Math.round(abs)}h overdue`;
    if (hours < 1)  return `${Math.round(hours * 60)}m left`;
    if (hours < 24) return `${Math.round(hours)}h left`;
    const d = Math.floor(hours / 24), h = Math.round(hours % 24);
    return h > 0 ? `${d}d ${h}h left` : `${d}d left`;
  },

  getSLALabel(p: Priority): string {
    const h = SLA_TABLE[p]?.resolutionHours ?? 72;
    return h < 24 ? `${h}h` : `${h / 24}d`;
  },

  getResolutionHours(p: Priority): number { return SLA_TABLE[p]?.resolutionHours ?? 72; },
};
