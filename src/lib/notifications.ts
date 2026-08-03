import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import type {
  AppNotification,
  Complaint,
  NotificationEvent,
  UserProfile,
} from "./types";

const LS_NOTIFS = "civicpulse.notifications";

function lsRead(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_NOTIFS) ?? "[]");
  } catch {
    return [];
  }
}
function lsWrite(v: AppNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_NOTIFS, JSON.stringify(v));
}

// ---------- Copy for each lifecycle event ----------

const COPY: Record<NotificationEvent, { title: string; message: string }> = {
  submitted: {
    title: "Complaint submitted",
    message: "Your report was received and queued for AI verification.",
  },
  verified: {
    title: "Complaint verified",
    message: "AI verification passed. Awaiting assignment to a field worker.",
  },
  assigned: {
    title: "Worker assigned",
    message: "A field worker has been assigned to this complaint.",
  },
  in_progress: {
    title: "Repair started",
    message: "The assigned worker has started repair work on site.",
  },
  resolved: {
    title: "Complaint resolved",
    message: "Work is complete and the complaint has been closed.",
  },
  rejected: {
    title: "Complaint rejected",
    message: "This complaint was reviewed and rejected by the authority.",
  },
};

// ---------- Write ----------

export async function createNotification(
  n: Omit<AppNotification, "id" | "createdAt" | "read"> & { read?: boolean },
): Promise<void> {
  const base = { ...n, read: n.read ?? false, createdAt: Date.now() };
  if (firebaseConfigured) {
    await addDoc(collection(db, "notifications"), {
      ...base,
      createdAt: serverTimestamp(),
    });
    return;
  }
  const list = lsRead();
  list.unshift({
    ...base,
    id: `n_${base.createdAt}_${Math.random().toString(36).slice(2, 8)}`,
  });
  lsWrite(list.slice(0, 200));
}

async function authorityUids(): Promise<string[]> {
  if (firebaseConfigured) {
    const snap = await getDocs(
      query(collection(db, "users"), where("role", "==", "authority")),
    );
    return snap.docs.map((d) => (d.data() as UserProfile).uid);
  }
  try {
    const mock: { uid: string; role: string }[] = JSON.parse(
      localStorage.getItem("civicpulse.mockusers") ?? "[]",
    );
    return mock.filter((u) => u.role === "authority").map((u) => u.uid);
  } catch {
    return [];
  }
}

/**
 * Fan a complaint lifecycle event out to every interested party:
 * the reporting citizen, all authorities, and the assigned worker.
 */
export async function notifyComplaintEvent(
  event: NotificationEvent,
  complaint: Pick<
    Complaint,
    "id" | "category" | "status" | "citizenId" | "assignedWorkerId"
  >,
): Promise<void> {
  const copy = COPY[event];
  const recipients = new Set<string>();
  if (complaint.citizenId) recipients.add(complaint.citizenId);
  for (const uid of await authorityUids()) recipients.add(uid);
  if (complaint.assignedWorkerId) recipients.add(complaint.assignedWorkerId);

  await Promise.all(
    [...recipients].map((userId) =>
      createNotification({
        userId,
        event,
        title: copy.title,
        message: `${complaint.category} · #${complaint.id.slice(-6)} — ${copy.message}`,
        complaintId: complaint.id,
        category: complaint.category,
        status: complaint.status,
      }),
    ),
  );
}

// ---------- Read (real time) ----------

export function subscribeNotifications(
  uid: string,
  cb: (list: AppNotification[]) => void,
): () => void {
  const sort = (l: AppNotification[]) =>
    [...l].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);

  if (!firebaseConfigured) {
    const tick = () => cb(sort(lsRead().filter((n) => n.userId === uid)));
    tick();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_NOTIFS) tick();
    };
    window.addEventListener("storage", onStorage);
    const int = setInterval(tick, 1500);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(int);
    };
  }

  // No orderBy: keeps this index-free; sorting happens client side.
  const q = query(collection(db, "notifications"), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    cb(
      sort(
        snap.docs.map((d) => {
          const raw = d.data() as Record<string, unknown>;
          const createdAt = raw.createdAt;
          return {
            ...(raw as unknown as AppNotification),
            id: d.id,
            createdAt:
              createdAt instanceof Timestamp
                ? createdAt.toMillis()
                : ((createdAt as number) ?? Date.now()),
          };
        }),
      ),
    );
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  if (firebaseConfigured) {
    await updateDoc(doc(db, "notifications", id), { read: true });
    return;
  }
  const list = lsRead();
  const idx = list.findIndex((n) => n.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], read: true };
    lsWrite(list);
  }
}

export async function markAllNotificationsRead(
  uid: string,
  ids: string[],
): Promise<void> {
  if (firebaseConfigured) {
    await Promise.all(ids.map((id) => markNotificationRead(id)));
    return;
  }
  const list = lsRead().map((n) =>
    n.userId === uid ? { ...n, read: true } : n,
  );
  lsWrite(list);
}
