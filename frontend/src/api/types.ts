export type RoleName = 'COLLABORATOR' | 'EDITOR' | 'ADMIN';
export type RecordStatus = 'ACTIVE' | 'ARCHIVED';
export type VersionStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'REJECTED';

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
  canManage: boolean;
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

export interface Dashboard {
  stats: { procedures: number; processes: number; areas: number };
  recentUpdates: {
    versionNumber: number;
    changeSummary: string;
    publishedAt: string;
    procedure: { id: number; code: string; title: string; process: { code: string; name: string; area: { name: string } } };
  }[];
  management: { drafts: number; inReview: number } | null;
}

export interface MessageResponse {
  message: string;
}
