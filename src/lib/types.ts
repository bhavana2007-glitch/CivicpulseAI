export type Role = "citizen" | "authority" | "worker";

export type ComplaintStatus =
  | "submitted"
  | "verified"
  | "assigned"
  | "en_route"
  | "in_progress"
  | "completed"
  | "rejected";

export const STATUS_FLOW: ComplaintStatus[] = [
  "submitted",
  "verified",
  "assigned",
  "en_route",
  "in_progress",
  "completed",
];

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  submitted: "Submitted",
  verified: "Verified",
  assigned: "Assigned",
  en_route: "Worker En Route",
  in_progress: "Repair in Progress",
  completed: "Completed",
  rejected: "Rejected",
};


/** The ONLY approved civic issue categories. */
export type Category =
  | "Pothole"
  | "Water Logging"
  | "Water Leak"
  | "Drainage Issue"
  | "Garbage Overflow"
  | "Broken Streetlight"
  | "Power Outage"
  | "Fallen Tree"
  | "Road Damage"
  | "Illegal Dumping";

export type Severity = "Low" | "Medium" | "High";

export type Priority = "low" | "medium" | "high" | "critical";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: Role;
  ward?: string;
  createdAt: number;
}

export interface Complaint {
  id: string;
  citizenId: string;
  citizenName: string;
  category: Category;
  description: string;
  imageUrl?: string;
  lat: number;
  lng: number;
  address?: string;
  priority: Priority;
  severity?: Severity;
  /** Original AI prediction, kept even when the citizen overrides it. */
  aiCategory?: Category;
  aiConfidence?: number;
  /** True when the citizen manually corrected the AI category. */
  manualOverride?: boolean;
  status: ComplaintStatus;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  department?: string;
  createdAt: number;
  updatedAt: number;
  proofUrl?: string;
  feedback?: { rating: number; comment: string };
}

/** Lifecycle events that generate notifications. */
export type NotificationEvent =
  | "submitted"
  | "verified"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "rejected";

export interface AppNotification {
  id: string;
  /** Recipient uid. */
  userId: string;
  event: NotificationEvent;
  title: string;
  message: string;
  complaintId: string;
  category: Category;
  status: ComplaintStatus;
  read: boolean;
  createdAt: number;
}

