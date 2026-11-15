export type RoleName = 'COLLABORATOR' | 'EDITOR' | 'ADMIN';
export type RecordStatus = 'ACTIVE' | 'ARCHIVED';
export type VersionStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'REJECTED';
export type RelationType = 'INFORMATION_HANDOFF' | 'TRIGGERS' | 'DEPENDS_ON';
export type StepStatus = 'READ' | 'UPDATED' | 'PENDING' | 'LOCKED';

export interface NamedRef {
  id: number;
  name: string;
}

export interface LevelRef extends NamedRef {
  level: number;
}

export interface PersonRef {
  firstName: string;
  lastName: string;
}

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  hireDate: string;
  isActive: boolean;
  lastLoginAt: string | null;
  area: NamedRef;
  role: { id: number; name: RoleName };
  accessLevel: LevelRef;
}

export interface AdminUser extends Profile {
  invitationPending: boolean;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: Profile;
}

export interface TokenInfo {
  purpose: 'reset' | 'invite';
  email: string;
  firstName: string;
}

export interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  area: NamedRef;
  role: { name: RoleName };
}

export interface Role {
  id: number;
  name: RoleName;
  description: string | null;
}

export interface Area {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  activeUsers: number;
  activeProcesses: number;
}

export interface AccessLevel {
  id: number;
  name: string;
  level: number;
  description: string | null;
  users: number;
  contents: number;
}

export interface ProcessSummary {
  id: number;
  code: string;
  name: string;
  objective: string;
  scope: string | null;
  isCrossArea: boolean;
  status: RecordStatus;
  updatedAt: string;
  area: NamedRef;
  accessLevel: LevelRef;
  owner: PersonRef & { id: string };
}

export interface ProcessCard extends ProcessSummary {
  procedureCount: number;
  lastUpdatedAt: string | null;
}

export interface ProcessList {
  items: ProcessCard[];
  hiddenCount: number;
}

export interface ManagedProcess extends ProcessSummary {
  visibleAreas: NamedRef[];
  procedureCount: number;
}

export interface CurrentVersionRef {
  versionNumber: number;
  changeSummary: string;
  publishedAt: string | null;
}

export interface RelatedProcess {
  id: number;
  relationType: RelationType;
  description: string | null;
  process: { id: number; code: string; name: string; area: NamedRef };
}

export interface ProcessRelations {
  outgoing: RelatedProcess[];
  incoming: RelatedProcess[];
}

export interface ProcessDetail extends ProcessSummary {
  visibleAreas: NamedRef[];
  procedures: {
    id: number;
    code: string;
    title: string;
    sortOrder: number;
    accessLevel: LevelRef;
    currentVersion: CurrentVersionRef | null;
  }[];
  relations: ProcessRelations;
  canManage: boolean;
}

export interface RelationForm {
  targetProcessId: number;
  relationType: RelationType;
  description: string | null;
}

export interface ProcessForm {
  code: string;
  name: string;
  objective: string;
  scope: string | null;
  areaId: number;
  ownerId: string;
  accessLevelId: number;
  isCrossArea: boolean;
  visibleAreaIds: number[];
  relations: RelationForm[];
}

export interface ProcessMap {
  nodes: { id: number; code: string; name: string; isCrossArea: boolean; area: NamedRef; procedureCount: number }[];
  edges: { id: number; sourceProcessId: number; targetProcessId: number; relationType: RelationType; description: string | null }[];
}

export interface ProcessEdit extends ProcessForm {
  id: number;
  status: RecordStatus;
}

export interface VersionSummary {
  id: number;
  versionNumber: number;
  status: VersionStatus;
  changeSummary: string;
  reviewNotes: string | null;
  createdAt: string;
  publishedAt: string | null;
  author: PersonRef;
}

export interface VersionWithContent extends VersionSummary {
  content: string;
}

export interface ProcedureDetail {
  id: number;
  code: string;
  title: string;
  sortOrder: number;
  accessLevel: LevelRef;
  process: { id: number; code: string; name: string; area: NamedRef; owner: PersonRef };
  currentVersion: VersionWithContent | null;
  history: VersionSummary[];
  reading: { lastReadVersion: number | null; confirmedAt: string | null; currentConfirmed: boolean };
  relations: ProcessRelations;
  canManage: boolean;
  workflow: VersionSummary[];
}

export interface VersionDetail extends VersionWithContent {
  isCurrent: boolean;
}

export interface VersionRef {
  id: number;
  versionNumber: number;
  status: VersionStatus;
  createdAt: string;
  publishedAt: string | null;
}

export interface ManagedProcedure {
  id: number;
  code: string;
  title: string;
  sortOrder: number;
  status: RecordStatus;
  accessLevel: LevelRef;
  process: { id: number; code: string; name: string; status: RecordStatus; area: NamedRef };
  currentVersion: VersionRef | null;
  openVersion: VersionRef | null;
  latestVersion: VersionRef | null;
}

export interface ProcedureEdit {
  id: number;
  code: string;
  title: string;
  sortOrder: number;
  status: RecordStatus;
  accessLevelId: number;
  process: { id: number; code: string; name: string };
  openVersion: VersionWithContent | null;
  currentVersion: VersionWithContent | null;
  lastRejection: VersionSummary | null;
}

export interface SavedVersion {
  id: number;
  procedureId: number;
  versionNumber: number;
  status: VersionStatus;
  content: string;
  changeSummary: string;
  createdAt: string;
}

export interface CreatedProcedure {
  id: number;
  code: string;
  title: string;
  openVersion: { id: number; versionNumber: number; status: VersionStatus };
}

export interface SearchResult {
  id: number;
  code: string;
  title: string;
  processId: number;
  processCode: string;
  processName: string;
  areaId: number;
  areaName: string;
  versionNumber: number;
  publishedAt: string;
  snippet: string;
  rank: number;
}

export interface Progress {
  required: number;
  completed: number;
  pct: number | null;
}

export interface Dashboard {
  stats: { procedures: number; processes: number; areas: number };
  recentUpdates: {
    versionNumber: number;
    changeSummary: string;
    publishedAt: string;
    procedure: { id: number; code: string; title: string; process: { code: string; name: string; area: { name: string } } };
  }[];
  pendingReads: {
    procedureId: number;
    code: string;
    title: string;
    versionNumber: number;
    changeSummary: string;
    publishedAt: string;
    changed: boolean;
  }[];
  onboarding: (Progress & { routeId: number; name: string; dueDate: string | null })[];
  management: { drafts: number; inReview: number; reviews: number | null } | null;
}

export interface OnboardingStep {
  procedureId: number;
  code: string;
  title: string;
  processName: string;
  stepOrder: number;
  isRequired: boolean;
  currentVersion: number | null;
  status: StepStatus;
  confirmedAt: string | null;
  lastReadVersion: number | null;
}

export interface MyRoute {
  assignedAt: string;
  dueDate: string | null;
  route: { id: number; name: string; description: string | null; area: { name: string } | null; creator: PersonRef };
  progress: Progress | null;
  optional: { total: number; completed: number };
  steps: OnboardingStep[];
}

export interface RouteSummary {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  area: NamedRef | null;
  stepCount: number;
  requiredCount: number;
  assignmentCount: number;
}

export interface RouteDetail {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  areaId: number | null;
  area: NamedRef | null;
  creator: PersonRef;
  steps: {
    procedureId: number;
    code: string;
    title: string;
    processName: string;
    stepOrder: number;
    isRequired: boolean;
    active: boolean;
    currentVersion: number | null;
  }[];
  assignments: {
    assignedAt: string;
    dueDate: string | null;
    user: PersonRef & { id: string; area: { name: string } };
    progress: Progress | null;
  }[];
}

export interface RouteProcedureOption {
  id: number;
  code: string;
  title: string;
  accessLevel: { name: string; level: number };
  process: { code: string; name: string; area: { name: string } };
}

export interface RouteProgressRow extends Progress {
  routeId: number;
  routeName: string;
  userId: string;
  firstName: string;
  lastName: string;
  areaName: string;
  assignedAt: string;
  dueDate: string | null;
}

export interface CoverageRow {
  procedureId: number;
  code: string;
  title: string;
  versionNumber: number;
  publishedAt: string;
  audience: number;
  confirmed: number;
}

export interface ReviewItem {
  id: number;
  versionNumber: number;
  changeSummary: string;
  createdAt: string;
  submittedAt: string;
  author: PersonRef;
  procedure: { id: number; code: string; title: string; process: { code: string; name: string; area: NamedRef } };
}

export interface ReviewDetail {
  id: number;
  versionNumber: number;
  content: string;
  changeSummary: string;
  createdAt: string;
  author: PersonRef;
  procedure: { id: number; code: string; title: string; accessLevel: { name: string }; process: { id: number; code: string; name: string; area: NamedRef } };
  currentVersion: { versionNumber: number; content: string; publishedAt: string | null } | null;
  impact: { users: number; routes: number };
}

export interface AuditItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: PersonRef | null;
}

export interface AuditPage {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MessageResponse {
  message: string;
}
