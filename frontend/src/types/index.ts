export type Role = 'ADMIN' | 'VIEWER' | 'OPERATOR' | 'SUPERVISOR' | 'MAINTENANCE';
export type CertStatus = 'ACTIVE' | 'NOTICE_DUE' | 'NOTICE_SENT' | 'EXPIRED';
export type CertificateStatus = 'ISSUED' | 'PENDING' | 'EXPIRED';
export type NoticeStatus = 'NOT_SENT' | 'SENT';
export type NoticeMethod = 'EMAIL' | 'LETTER';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
export type TicketSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Scanner {
  id: string;
  serialNumber: string;
  acceleratorSerial: string;
  manufacturer: string;
  type: string;
  location?: string;
  createdAt: string;
  latestCert?: Certification;
  certifications?: Certification[];
}

export interface Certification {
  id: string;
  scannerId: string;
  scanner?: Scanner;
  inspectionDate: string;
  expiryDate: string;
  noticeDate: string;
  certificateStatus: CertificateStatus;
  status: CertStatus;
  documentUrl?: string;
  documentName?: string;
  daysToExpiry?: number;
  notifications?: Notification[];
  alertLogs?: AlertLog[];
  createdAt: string;
}

export interface Notification {
  id: string;
  certificationId: string;
  certification?: Certification;
  noticeStatus: NoticeStatus;
  dateSent?: string;
  method?: NoticeMethod;
  referenceNumber?: string;
  documentUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface AlertLog {
  id: string;
  certificationId: string;
  certification?: Certification;
  type: string;
  message: string;
  resolved: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalScanners: number;
  active: number;
  noticeDue: number;
  noticeSent: number;
  expiring120: number;
  expired: number;
  pendingNotices: number;
  recentAlerts: AlertLog[];
}

// ─── Incident Management Types ───────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
}

export interface SlaMeta {
  slaHours: number;
  responseHours: number;
  resolutionDeadline: string;
  responseDeadline: string;
  responseBreached: boolean;
  resolutionBreached: boolean;
  minutesRemaining: number;
  hoursElapsed: number;
}

export interface TicketActivity {
  id: string;
  ticketId: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  notes?: string;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email'>;
}

export interface Attachment {
  id: string;
  ticketId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  locationId: string;
  location?: Location;
  equipmentType: string;
  issueType: string;
  severity: TicketSeverity;
  status: TicketStatus;
  escalationLevel: number;
  reportedById: string;
  reportedBy?: Pick<User, 'id' | 'name' | 'email'>;
  assignedTo?: string;
  assignedToId?: string;
  assignedToUser?: Pick<User, 'id' | 'name' | 'email'>;
  startTime: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  resolutionNotes?: string;
  downtimeMinutes?: number;
  slaBreached: boolean;
  attachments?: Attachment[];
  activities?: TicketActivity[];
  sla?: SlaMeta;
  _count?: { activities: number; attachments: number };
  createdAt: string;
  updatedAt: string;
}

export interface TicketListResponse {
  total: number;
  page: number;
  limit: number;
  tickets: Ticket[];
}

export interface IncidentMeta {
  issueTypes: string[];
  equipmentTypes: string[];
  severities: TicketSeverity[];
  statuses: TicketStatus[];
  assignableTeams: string[];
}

// ─── Agent Request Types ─────────────────────────────────────────────────────

export type AgentRequestType   = 'SEAL_CUTTING' | 'GANG_UNSTUFFING';
export type AgentRequestStatus = 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
export type ContainerSize      = '20FT' | '40FT' | '45FT';
export type BayZone            = '1-50' | '51-80';

export interface AgentRequest {
  id:              string;
  requestNumber:   string;
  requestType:     AgentRequestType;
  status:          AgentRequestStatus;
  containerNumber: string;
  containerSize:   ContainerSize;
  sealNumber?:     string;
  bayZone?:        BayZone;
  bayNumber?:      string;
  gangAssigned?:   string;
  agencyName?:     string;
  agentName?:      string;
  agentPhone?:     string;
  itemDescription?:string;
  completionTime?: string;
  notes?:          string;
  submittedById:   string;
  submittedBy?:    Pick<User, 'id' | 'name' | 'email'>;
  createdAt:       string;
  updatedAt:       string;
}

export interface AgentRequestListResponse {
  total:    number;
  page:     number;
  limit:    number;
  requests: AgentRequest[];
}

export interface AgentRequestStats {
  total:          number;
  pending:        number;
  approved:       number;
  inProgress:     number;
  completed:      number;
  sealCutting:    number;
  gangUnstuffing: number;
  todayCount:     number;
}

export interface IncidentStats {
  totalToday: number;
  openTickets: number;
  inProgressTickets: number;
  escalatedTickets: number;
  criticalOpen: number;
  resolvedToday: number;
  mttrMinutes: number;
  slaCompliance: number;
  totalDowntimeToday: number;
  byLocation: {
    locationId: string;
    locationName: string;
    locationCode: string;
    ticketCount: number;
    totalDowntime: number;
  }[];
  byIssueType: { issueType: string; _count: { id: number } }[];
  bySeverity:  { severity: string; _count: { id: number } }[];
  recentTickets: Ticket[];
}
