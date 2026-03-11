// ─── Roles ───────────────────────────────────────────────────────────────────
export enum UserRole {
  CITIZEN    = 'CITIZEN',
  OFFICER    = 'OFFICER',
  SUPERVISOR = 'SUPERVISOR',
  ADMIN      = 'ADMIN',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  passwordHash?: string;
}

// ─── Grievance Status ─────────────────────────────────────────────────────────
export enum GrievanceStatus {
  SUBMITTED    = 'SUBMITTED',
  PENDING      = 'PENDING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS  = 'IN_PROGRESS',
  ESCALATED    = 'ESCALATED',
  RESOLVED     = 'RESOLVED',
  CLOSED       = 'CLOSED',
  REJECTED     = 'REJECTED',
  REOPENED     = 'REOPENED',
}

// ─── Categories ───────────────────────────────────────────────────────────────
export enum GrievanceCategory {
  ROADS          = 'ROADS & TRANSPORT',
  WATER          = 'WATER & SANITATION',
  ELECTRICITY    = 'ELECTRICITY',
  HEALTHCARE     = 'HEALTHCARE',
  EDUCATION      = 'EDUCATION',
  PUBLIC_SAFETY  = 'PUBLIC SAFETY',
  ENVIRONMENT    = 'ENVIRONMENT',
  WELFARE        = 'WELFARE SCHEMES',
  CORRUPTION     = 'CORRUPTION',
  OTHER          = 'OTHER',
}

// ─── Priority ─────────────────────────────────────────────────────────────────
export enum Priority {
  CRITICAL = 'CRITICAL',
  HIGH     = 'HIGH',
  MEDIUM   = 'MEDIUM',
  LOW      = 'LOW',
}

// ─── Admin Level for Escalation ───────────────────────────────────────────────
export enum AdminLevel {
  OFFICER    = 1,
  SUPERVISOR = 2,
  ADMIN      = 3,
}

// ─── SLA ─────────────────────────────────────────────────────────────────────
export enum SLAStatus {
  ON_TRACK  = 'ON_TRACK',
  AT_RISK   = 'AT_RISK',
  BREACHED  = 'BREACHED',
  COMPLETED = 'COMPLETED',
}

export interface SLAInfo {
  status: SLAStatus;
  deadline: number;
  acknowledgeDeadline: number;
  hoursRemaining: number;
  percentElapsed: number;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────
export interface WorkflowStep {
  id: string;
  status: GrievanceStatus;
  label: string;
  performedBy: string;
  performedById?: string;
  note?: string;
  timestamp: number;
  automated: boolean;
}

// ─── Escalation ───────────────────────────────────────────────────────────────
export interface EscalationRecord {
  id: string;
  fromLevel: AdminLevel;
  toLevel: AdminLevel;
  reason: string;
  escalatedAt: number;
  escalatedByName: string;
}

// ─── Grievance ────────────────────────────────────────────────────────────────
export interface Grievance {
  id: string;
  ticketNumber: string;
  citizenId: string;
  citizenName: string;
  title: string;
  description: string;
  category: GrievanceCategory;
  status: GrievanceStatus;
  priority: Priority;
  currentLevel: AdminLevel;
  location?: string;
  proof?: string;
  proofType?: string;
  createdAt: number;
  updatedAt: number;
  adminResponse?: string;
  workflow: WorkflowStep[];
  escalations: EscalationRecord[];
  aiAnalysis?: {
    sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Urgent';
    summary: string;
    suggestedPriority: 'High' | 'Medium' | 'Low';
  };
}

// ─── Views ────────────────────────────────────────────────────────────────────
export type ViewState =
  | 'LOGIN'
  | 'DASHBOARD'
  | 'SUBMIT_NEW'
  | 'GRIEVANCE_DETAIL'
  | 'PUBLIC_REPORT';

// ─── Notifications ────────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'STATUS_CHANGE' | 'ADMIN_REPLY' | 'NEW_GRIEVANCE' | 'ESCALATION';
  relatedGrievanceId?: string;
  read: boolean;
  createdAt: number;
}
