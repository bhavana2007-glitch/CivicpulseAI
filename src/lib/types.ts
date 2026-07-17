export type Role = "citizen" | "authority" | "worker";

export type ComplaintStatus =
  | "submitted"
  | "verified"
  | "assigned"
  | "en_route"
  | "in_progress"
  | "completed";

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
};

export type Category =
  | "Pothole"
  | "Garbage"
  | "Water Leak"
  | "Streetlight"
  | "Parking"
  | "Other";

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
  status: ComplaintStatus;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  department?: string;
  createdAt: number;
  updatedAt: number;
  proofUrl?: string;
  feedback?: { rating: number; comment: string };
}
