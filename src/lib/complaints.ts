import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadString,uploadBytes,getDownloadURL } from "firebase/storage";
import { db, storage, firebaseConfigured } from "./firebase";
import { notifyComplaintEvent } from "./notifications";
import type {
  Complaint,
  ComplaintStatus,
  NotificationEvent,
  Role,
  UserProfile,
} from "./types";


// ---------- Local mock fallback (used until Firebase is configured) ----------
const LS_KEY = "civicpulse.complaints";
const LS_USERS = "civicpulse.users";

function lsRead<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(k) ?? "") ?? fallback;
  } catch {
    return fallback;
  }
}
function lsWrite<T>(k: string, v: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(k, JSON.stringify(v));
}

// ---------- Public API ----------

export async function createComplaint(
  data: Omit<Complaint, "id" | "createdAt" | "updatedAt" | "status">,
): Promise<string> {
  const now = Date.now();
  const base: Omit<Complaint, "id"> = {
    ...data,
    status: "submitted",
    createdAt: now,
    updatedAt: now,
  };
  let id: string;
  if (firebaseConfigured) {
    const docRef = await addDoc(collection(db, "complaints"), {
      ...base,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Auto-verify (mock AI already validated)
    await updateDoc(doc(db, "complaints", docRef.id), {
      status: "verified" as ComplaintStatus,
      updatedAt: serverTimestamp(),
    });
    id = docRef.id;
  } else {
    id = `c_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const list = lsRead<Complaint[]>(LS_KEY, []);
    list.unshift({ ...base, id, status: "verified" });
    lsWrite(LS_KEY, list);
  }

  const ref_ = {
    id,
    category: base.category,
    citizenId: base.citizenId,
    assignedWorkerId: base.assignedWorkerId,
  };
  await notifyComplaintEvent("submitted", { ...ref_, status: "submitted" });
  await notifyComplaintEvent("verified", { ...ref_, status: "verified" });
  return id;
}


export async function uploadImage(
  path: string,
  dataUrl: string,
): Promise<string> {
  if (!firebaseConfigured) return dataUrl;
  const r = ref(storage, path);
  await uploadString(r, dataUrl, "data_url");
  return getDownloadURL(r);
}
export async function uploadVoice(
  path: string,
  blob: Blob,
): Promise<string> {
  if (!firebaseConfigured) {
    return URL.createObjectURL(blob);
  }

  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob);

  return getDownloadURL(storageRef);
}

export function subscribeComplaints(
  cb: (list: Complaint[]) => void,
  opts: { role: Role; uid: string },
): () => void {
  if (!firebaseConfigured) {
    const tick = () => {
      const list = lsRead<Complaint[]>(LS_KEY, []);
      cb(filterByRole(list, opts));
    };
    tick();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) tick();
    };
    window.addEventListener("storage", onStorage);
    const int = setInterval(tick, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(int);
    };
  }
  const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list: Complaint[] = snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      const createdAt = raw.createdAt;
      const updatedAt = raw.updatedAt;
      return {
        ...(raw as unknown as Complaint),
        id: d.id,
        createdAt:
          createdAt instanceof Timestamp
            ? createdAt.toMillis()
            : ((raw.createdAt as number) ?? Date.now()),
        updatedAt:
          updatedAt instanceof Timestamp
            ? updatedAt.toMillis()
            : ((raw.updatedAt as number) ?? Date.now()),
      };
    });
    cb(filterByRole(list, opts));
  });
}

/**
 * Public, unauthenticated live feed of ALL complaints (newest first).
 * Consumers must strip citizen identity fields before rendering.
 */
export function subscribePublicComplaints(
  cb: (list: Complaint[]) => void,
): () => void {
  const sort = (l: Complaint[]) =>
    [...l].sort((a, b) => b.createdAt - a.createdAt);
  if (!firebaseConfigured) {
    const tick = () => cb(sort(lsRead<Complaint[]>(LS_KEY, [])));
    tick();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) tick();
    };
    window.addEventListener("storage", onStorage);
    const int = setInterval(tick, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(int);
    };
  }
  const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list: Complaint[] = snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      const createdAt = raw.createdAt;
      const updatedAt = raw.updatedAt;
      return {
        ...(raw as unknown as Complaint),
        id: d.id,
        createdAt:
          createdAt instanceof Timestamp
            ? createdAt.toMillis()
            : ((raw.createdAt as number) ?? Date.now()),
        updatedAt:
          updatedAt instanceof Timestamp
            ? updatedAt.toMillis()
            : ((raw.updatedAt as number) ?? Date.now()),
      };
    });
    cb(sort(list));
  });
}

function filterByRole(
  list: Complaint[],
  { role, uid }: { role: Role; uid: string },
): Complaint[] {
  if (role === "citizen") return list.filter((c) => c.citizenId === uid);
  if (role === "worker") return list.filter((c) => c.assignedWorkerId === uid);
  return list;
}

const STATUS_EVENT: Partial<Record<ComplaintStatus, NotificationEvent>> = {
  verified: "verified",
  assigned: "assigned",
  in_progress: "in_progress",
  completed: "resolved",
  rejected: "rejected",
};

export async function updateComplaint(
  id: string,
  patch: Partial<Complaint>,
): Promise<void> {
  const updatedAt = Date.now();
  let after: Complaint | null = null;
  let prevStatus: ComplaintStatus | undefined;

  if (firebaseConfigured) {
    const snap = await getDoc(doc(db, "complaints", id));
    const prev = snap.exists() ? (snap.data() as Complaint) : null;
    prevStatus = prev?.status;
    await updateDoc(doc(db, "complaints", id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    if (prev) after = { ...prev, ...patch, id };
  } else {
    const list = lsRead<Complaint[]>(LS_KEY, []);
    const idx = list.findIndex((c) => c.id === id);
    if (idx >= 0) {
      prevStatus = list[idx].status;
      list[idx] = { ...list[idx], ...patch, updatedAt };
      lsWrite(LS_KEY, list);
      after = list[idx];
    }
  }

  const event =
    patch.status && patch.status !== prevStatus
      ? STATUS_EVENT[patch.status]
      : undefined;
  if (event && after) {
    await notifyComplaintEvent(event, {
      id,
      category: after.category,
      status: after.status,
      citizenId: after.citizenId,
      assignedWorkerId: after.assignedWorkerId,
    });
  }
}

/** Live single-complaint stream used by the tracking page. */
export function subscribeComplaint(
  id: string,
  cb: (c: Complaint | null) => void,
): () => void {
  if (!firebaseConfigured) {
    const tick = () =>
      cb(lsRead<Complaint[]>(LS_KEY, []).find((c) => c.id === id) ?? null);
    tick();
    const int = setInterval(tick, 1500);
    return () => clearInterval(int);
  }
  return onSnapshot(doc(db, "complaints", id), (snap) => {
    if (!snap.exists()) return cb(null);
    const raw = snap.data() as Record<string, unknown>;
    const createdAt = raw.createdAt;
    const updatedAt = raw.updatedAt;
    cb({
      ...(raw as unknown as Complaint),
      id: snap.id,
      createdAt:
        createdAt instanceof Timestamp
          ? createdAt.toMillis()
          : ((createdAt as number) ?? Date.now()),
      updatedAt:
        updatedAt instanceof Timestamp
          ? updatedAt.toMillis()
          : ((updatedAt as number) ?? Date.now()),
    });
  });
}


// ---------- Users (workers list, etc) ----------
interface MockUserRecord {
  uid: string;
  email: string;
  name: string;
  role: Role;
}
export async function listUsersByRole(role: Role): Promise<UserProfile[]> {
  if (firebaseConfigured) {
    const q = query(collection(db, "users"), where("role", "==", role));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  }
  const users = lsRead<UserProfile[]>(LS_USERS, []);
  // Also include mock-auth registered users (auth-context stores under civicpulse.mockusers)
  const mock = lsRead<MockUserRecord[]>("civicpulse.mockusers", []);
  const mockProfiles: UserProfile[] = mock
    .filter((u) => u.role === role)
    .map((u) => ({
      uid: u.uid,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: 0,
    }));
  const merged = [...users, ...mockProfiles].filter((u) => u.role === role);
  // Dedupe by uid
  const seen = new Set<string>();
  return merged.filter((u) => (seen.has(u.uid) ? false : (seen.add(u.uid), true)));
}
