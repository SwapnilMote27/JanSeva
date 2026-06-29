export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  points: number;
  badges: string[];
  totalReports: number;
  resolvedIssues: number;
  createdAt: any;
  role: 'citizen' | 'admin';
  bio?: string;
  phone?: string;
  notificationsEnabled?: boolean;
  weeklyEmailSummaryEnabled?: boolean;
}

export type SeverityType = 'Low' | 'Medium' | 'High' | 'Critical';
export type StatusType = 'Reported' | 'Verified' | 'Assigned' | 'In Progress' | 'Resolved';

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: SeverityType;
  status: StatusType;
  location: {
    lat: number;
    lng: number;
  };
  imageBase64: string;
  imagesBase64?: string[];
  videoBase64?: string | null;
  videoName?: string | null;
  reportedBy: string;
  reportedByName: string;
  reportedByPhoto: string;
  reportedAt: any;
  incidentDate?: string;
  upvotes: number;
  upvotedBy: string[];
  verifications: number;
  verifiedBy: string[];
  resolvedVerifications?: number;
  resolvedVerifiedBy?: string[];
  suggestedDepartment: string;
  aiConfidence: number;
  resolvedAt: any | null;
}

export interface Comment {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string;
  text: string;
  timestamp: any;
  likes?: number;
  likedBy?: string[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  issueId: string;
  issueTitle: string;
  type: 'status_update' | 'comment' | 'verification';
  read: boolean;
  createdAt: any;
}

