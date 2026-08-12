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

import {
  ref,
  uploadString,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, storage, firebaseConfigured } from "./firebase";
import { notifyComplaintEvent } from "./notifications";

import type {
  Complaint,
  ComplaintStatus,
  NotificationEvent,
  Role,
  UserProfile,
} from "./types";

// ---------- Local mock fallback ----------

const LS_KEY = "civicpulse.complaints";
const LS_USERS = "civicpulse.users";

function lsRead<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    return (
      JSON.parse(localStorage.getItem(k) ?? "") ?? fallback
    );
  } catch {
    return fallback;
  }
}

function lsWrite<T>(k: string, v: T) {
  if (typeof window === "undefined") return;

  localStorage.setItem(k, JSON.stringify(v));
}


// ============================================================
// 🤖 CIVICPULSE AI ASSIGNMENT AGENT
// ============================================================

/**
 * Automatically assigns a newly created complaint
 * to an available demo worker.
 *
 * Current demo strategy:
 *   1. Find users whose role is "worker"
 *   2. Prefer a worker matching the complaint department
 *   3. Otherwise use the first available worker
 *
 * Later this can be upgraded with:
 *   - worker availability
 *   - distance
 *   - workload
 *   - severity
 *   - department
 *   - live location
 */
async function runAssignmentAgent(
  complaintId: string,
  data: {
    category: Complaint["category"];
    department?: string;
    priority?: Complaint["priority"];
  },
): Promise<{
  assignedWorkerId: string;
  assignedWorkerName: string;
} | null> {
  try {
    if (!firebaseConfigured) {
      console.warn(
        "🤖 Assignment Agent: Firebase is not configured.",
      );

      return null;
    }

    console.log(
      "🤖 CivicPulse Assignment Agent started",
    );

    console.log(
      "Complaint:",
      complaintId,
    );

    console.log(
      "Category:",
      data.category,
    );

    console.log(
      "Department:",
      data.department,
    );

    console.log(
      "Priority:",
      data.priority,
    );

    // --------------------------------------------------------
    // Find all workers
    // --------------------------------------------------------

    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker"),
    );

    const workersSnapshot =
      await getDocs(workersQuery);

    const workers: UserProfile[] =
      workersSnapshot.docs.map(
        (workerDoc) =>
          workerDoc.data() as UserProfile,
      );

    if (workers.length === 0) {
      console.warn(
        "🤖 Assignment Agent: No workers found.",
      );

      return null;
    }

    // --------------------------------------------------------
    // Try to find a worker matching the department
    // --------------------------------------------------------

    const normalizedDepartment =
      (data.department ?? "")
        .toLowerCase()
        .trim();

    let selectedWorker: UserProfile | undefined;

    if (normalizedDepartment) {
      selectedWorker = workers.find(
        (worker) => {
          const workerDepartment =
            (
              worker as UserProfile & {
                department?: string;
              }
            ).department
              ?.toLowerCase()
              .trim();

          return (
            workerDepartment ===
            normalizedDepartment
          );
        },
      );
    }

    // --------------------------------------------------------
    // Demo fallback
    // --------------------------------------------------------

    if (!selectedWorker) {
      selectedWorker = workers[0];
    }

    if (!selectedWorker?.uid) {
      console.warn(
        "🤖 Assignment Agent: Selected worker has no UID.",
      );

      return null;
    }

    // --------------------------------------------------------
    // Update complaint
    // --------------------------------------------------------

    await updateDoc(
      doc(
        db,
        "complaints",
        complaintId,
      ),
      {
        assignedWorkerId:
          selectedWorker.uid,

        assignedWorkerName:
          selectedWorker.name ?? "Demo Worker",

        status:
          "assigned" as ComplaintStatus,

        assignedAt:
          serverTimestamp(),

        assignmentSource:
          "civicpulse-ai-agent",

        assignmentCategory:
          data.category,

        assignmentDepartment:
          data.department ?? null,

        assignmentPriority:
          data.priority ?? "medium",

        updatedAt:
          serverTimestamp(),
      },
    );

    console.log(
      "✅ CivicPulse Agent assignment successful",
    );

    console.log(
      "👷 Worker:",
      selectedWorker.name,
    );

    console.log(
      "🆔 Worker ID:",
      selectedWorker.uid,
    );

    return {
      assignedWorkerId:
        selectedWorker.uid,

      assignedWorkerName:
        selectedWorker.name ??
        "Demo Worker",
    };
  } catch (error) {
    console.error(
      "❌ CivicPulse Assignment Agent failed:",
      error,
    );

    /*
     * Important:
     * We don't fail complaint creation just because
     * automatic worker assignment failed.
     */
    return null;
  }
}


// ============================================================
// CREATE COMPLAINT
// ============================================================

export async function createComplaint(
  data: Omit<
    Complaint,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "status"
  >,
): Promise<string> {
  const now = Date.now();

  const base: Omit<Complaint, "id"> = {
    ...data,
    status: "submitted",
    createdAt: now,
    updatedAt: now,
  };

  let id: string;

  // ==========================================================
  // FIREBASE MODE
  // ==========================================================

  if (firebaseConfigured) {
    const docRef = await addDoc(
      collection(db, "complaints"),
      {
        ...base,
        createdAt:
          serverTimestamp(),
        updatedAt:
          serverTimestamp(),
      },
    );

    id = docRef.id;

    // --------------------------------------------------------
    // Auto verification
    // --------------------------------------------------------

    await updateDoc(
      doc(
        db,
        "complaints",
        docRef.id,
      ),
      {
        status:
          "verified" as ComplaintStatus,

        updatedAt:
          serverTimestamp(),
      },
    );

    // --------------------------------------------------------
    // 🤖 RUN ASSIGNMENT AGENT
    // --------------------------------------------------------

    const assignment =
      await runAssignmentAgent(
        docRef.id,
        {
          category:
            base.category,

          department:
            base.department,

          priority:
            base.priority,
        },
      );

    // --------------------------------------------------------
    // Notify worker assignment
    // --------------------------------------------------------

    if (assignment) {
      await notifyComplaintEvent(
        "assigned",
        {
          id: docRef.id,

          category:
            base.category,

          status:
            "assigned",

          citizenId:
            base.citizenId,

          assignedWorkerId:
            assignment.assignedWorkerId,
        },
      );
    }
  }

  // ==========================================================
  // LOCAL MOCK MODE
  // ==========================================================

  else {
    id =
      `c_${now}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const list =
      lsRead<Complaint[]>(
        LS_KEY,
        [],
      );

    /*
     * Local demo mode:
     * If mock users contain a worker,
     * automatically assign the first one.
     */

    const mockUsers =
      lsRead<UserProfile[]>(
        LS_USERS,
        [],
      );

    const mockWorkers =
      mockUsers.filter(
        (u) =>
          u.role === "worker",
      );

    const mockWorker =
      mockWorkers[0];

    const localComplaint: Complaint = {
      ...base,
      id,

      status:
        mockWorker
          ? "assigned"
          : "verified",

      assignedWorkerId:
        mockWorker?.uid,

      assignedWorkerName:
        mockWorker?.name,
    };

    list.unshift(
      localComplaint,
    );

    lsWrite(
      LS_KEY,
      list,
    );

    if (mockWorker) {
      console.log(
        "🤖 Local Assignment Agent:",
        mockWorker.name,
      );
    }
  }

  // ==========================================================
  // SUBMITTED NOTIFICATION
  // ==========================================================

  const ref_ = {
    id,

    category:
      base.category,

    citizenId:
      base.citizenId,

    assignedWorkerId:
      base.assignedWorkerId,
  };

  await notifyComplaintEvent(
    "submitted",
    {
      ...ref_,
      status:
        "submitted",
    },
  );

  // ==========================================================
  // VERIFIED NOTIFICATION
  // ==========================================================

  await notifyComplaintEvent(
    "verified",
    {
      ...ref_,
      status:
        "verified",
    },
  );

  return id;
}


// ============================================================
// IMAGE UPLOAD
// ============================================================

export async function uploadImage(
  path: string,
  dataUrl: string,
): Promise<string> {
  if (!firebaseConfigured) {
    return dataUrl;
  }

  const r = ref(
    storage,
    path,
  );

  await uploadString(
    r,
    dataUrl,
    "data_url",
  );

  return getDownloadURL(r);
}


// ============================================================
// VOICE UPLOAD
// ============================================================

export async function uploadVoice(
  path: string,
  blob: Blob,
): Promise<string> {
  if (!firebaseConfigured) {
    return URL.createObjectURL(
      blob,
    );
  }

  const storageRef =
    ref(storage, path);

  await uploadBytes(
    storageRef,
    blob,
  );

  return getDownloadURL(
    storageRef,
  );
}


// ============================================================
// SUBSCRIBE COMPLAINTS
// ============================================================

export function subscribeComplaints(
  cb: (list: Complaint[]) => void,
  opts: {
    role: Role;
    uid: string;
  },
): () => void {
  // ----------------------------------------------------------
  // Local mode
  // ----------------------------------------------------------

  if (!firebaseConfigured) {
    const tick = () => {
      const list =
        lsRead<Complaint[]>(
          LS_KEY,
          [],
        );

      cb(
        filterByRole(
          list,
          opts,
        ),
      );
    };

    tick();

    const onStorage = (
      e: StorageEvent,
    ) => {
      if (e.key === LS_KEY) {
        tick();
      }
    };

    window.addEventListener(
      "storage",
      onStorage,
    );

    const int =
      setInterval(
        tick,
        2000,
      );

    return () => {
      window.removeEventListener(
        "storage",
        onStorage,
      );

      clearInterval(int);
    };
  }

  // ----------------------------------------------------------
  // Firebase mode
  // ----------------------------------------------------------

  const q = query(
    collection(
      db,
      "complaints",
    ),
    orderBy(
      "createdAt",
      "desc",
    ),
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: Complaint[] =
        snap.docs.map((d) => {
          const raw =
            d.data() as Record<
              string,
              unknown
            >;

          const createdAt =
            raw.createdAt;

          const updatedAt =
            raw.updatedAt;

          return {
            ...(raw as unknown as Complaint),

            id: d.id,

            createdAt:
              createdAt instanceof
              Timestamp
                ? createdAt.toMillis()
                : ((raw.createdAt as number) ??
                  Date.now()),

            updatedAt:
              updatedAt instanceof
              Timestamp
                ? updatedAt.toMillis()
                : ((raw.updatedAt as number) ??
                  Date.now()),
          };
        });

      cb(
        filterByRole(
          list,
          opts,
        ),
      );
    },
  );
}


// ============================================================
// PUBLIC COMPLAINT FEED
// ============================================================

export function subscribePublicComplaints(
  cb: (list: Complaint[]) => void,
): () => void {
  const sort = (
    l: Complaint[],
  ) =>
    [...l].sort(
      (a, b) =>
        b.createdAt -
        a.createdAt,
    );

  // ----------------------------------------------------------
  // Local mode
  // ----------------------------------------------------------

  if (!firebaseConfigured) {
    const tick = () =>
      cb(
        sort(
          lsRead<Complaint[]>(
            LS_KEY,
            [],
          ),
        ),
      );

    tick();

    const onStorage = (
      e: StorageEvent,
    ) => {
      if (e.key === LS_KEY) {
        tick();
      }
    };

    window.addEventListener(
      "storage",
      onStorage,
    );

    const int =
      setInterval(
        tick,
        2000,
      );

    return () => {
      window.removeEventListener(
        "storage",
        onStorage,
      );

      clearInterval(int);
    };
  }

  // ----------------------------------------------------------
  // Firebase mode
  // ----------------------------------------------------------

  const q = query(
    collection(
      db,
      "complaints",
    ),
    orderBy(
      "createdAt",
      "desc",
    ),
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: Complaint[] =
        snap.docs.map((d) => {
          const raw =
            d.data() as Record<
              string,
              unknown
            >;

          const createdAt =
            raw.createdAt;

          const updatedAt =
            raw.updatedAt;

          return {
            ...(raw as unknown as Complaint),

            id: d.id,

            createdAt:
              createdAt instanceof
              Timestamp
                ? createdAt.toMillis()
                : ((raw.createdAt as number) ??
                  Date.now()),

            updatedAt:
              updatedAt instanceof
              Timestamp
                ? updatedAt.toMillis()
                : ((raw.updatedAt as number) ??
                  Date.now()),
          };
        });

      cb(sort(list));
    },
  );
}


// ============================================================
// ROLE FILTER
// ============================================================

function filterByRole(
  list: Complaint[],
  {
    role,
    uid,
  }: {
    role: Role;
    uid: string;
  },
): Complaint[] {
  if (
    role === "citizen"
  ) {
    return list.filter(
      (c) =>
        c.citizenId === uid,
    );
  }

  if (
    role === "worker"
  ) {
    return list.filter(
      (c) =>
        c.assignedWorkerId ===
        uid,
    );
  }

  return list;
}


// ============================================================
// STATUS EVENTS
// ============================================================

const STATUS_EVENT: Partial<
  Record<
    ComplaintStatus,
    NotificationEvent
  >
> = {
  verified:
    "verified",

  assigned:
    "assigned",

  in_progress:
    "in_progress",

  completed:
    "resolved",

  rejected:
    "rejected",
};


// ============================================================
// UPDATE COMPLAINT
// ============================================================

export async function updateComplaint(
  id: string,
  patch: Partial<Complaint>,
): Promise<void> {
  const updatedAt =
    Date.now();

  let after:
    | Complaint
    | null = null;

  let prevStatus:
    | ComplaintStatus
    | undefined;

  // ----------------------------------------------------------
  // Firebase mode
  // ----------------------------------------------------------

  if (firebaseConfigured) {
    const snap =
      await getDoc(
        doc(
          db,
          "complaints",
          id,
        ),
      );

    const prev =
      snap.exists()
        ? (snap.data() as Complaint)
        : null;

    prevStatus =
      prev?.status;

    await updateDoc(
      doc(
        db,
        "complaints",
        id,
      ),
      {
        ...patch,

        updatedAt:
          serverTimestamp(),
      },
    );

    if (prev) {
      after = {
        ...prev,
        ...patch,
        id,
      };
    }
  }

  // ----------------------------------------------------------
  // Local mode
  // ----------------------------------------------------------

  else {
    const list =
      lsRead<Complaint[]>(
        LS_KEY,
        [],
      );

    const idx =
      list.findIndex(
        (c) =>
          c.id === id,
      );

    if (idx >= 0) {
      prevStatus =
        list[idx].status;

      list[idx] = {
        ...list[idx],
        ...patch,
        updatedAt,
      };

      lsWrite(
        LS_KEY,
        list,
      );

      after =
        list[idx];
    }
  }

  // ----------------------------------------------------------
  // Notification
  // ----------------------------------------------------------

  const event =
    patch.status &&
    patch.status !==
      prevStatus
      ? STATUS_EVENT[
          patch.status
        ]
      : undefined;

  if (
    event &&
    after
  ) {
    await notifyComplaintEvent(
      event,
      {
        id,

        category:
          after.category,

        status:
          after.status,

        citizenId:
          after.citizenId,

        assignedWorkerId:
          after.assignedWorkerId,
      },
    );
  }
}


// ============================================================
// SINGLE COMPLAINT STREAM
// ============================================================

export function subscribeComplaint(
  id: string,
  cb: (
    c: Complaint | null,
  ) => void,
): () => void {
  // ----------------------------------------------------------
  // Local mode
  // ----------------------------------------------------------

  if (!firebaseConfigured) {
    const tick = () =>
      cb(
        lsRead<Complaint[]>(
          LS_KEY,
          [],
        ).find(
          (c) =>
            c.id === id,
        ) ?? null,
      );

    tick();

    const int =
      setInterval(
        tick,
        1500,
      );

    return () =>
      clearInterval(int);
  }

  // ----------------------------------------------------------
  // Firebase mode
  // ----------------------------------------------------------

  return onSnapshot(
    doc(
      db,
      "complaints",
      id,
    ),
    (snap) => {
      if (!snap.exists()) {
        return cb(null);
      }

      const raw =
        snap.data() as Record<
          string,
          unknown
        >;

      const createdAt =
        raw.createdAt;

      const updatedAt =
        raw.updatedAt;

      cb({
        ...(raw as unknown as Complaint),

        id: snap.id,

        createdAt:
          createdAt instanceof
          Timestamp
            ? createdAt.toMillis()
            : ((createdAt as number) ??
              Date.now()),

        updatedAt:
          updatedAt instanceof
          Timestamp
            ? updatedAt.toMillis()
            : ((updatedAt as number) ??
              Date.now()),
      });
    },
  );
}


// ============================================================
// USERS
// ============================================================

interface MockUserRecord {
  uid: string;
  email: string;
  name: string;
  role: Role;
}


// ============================================================
// LIST USERS BY ROLE
// ============================================================

export async function listUsersByRole(
  role: Role,
): Promise<UserProfile[]> {
  // ----------------------------------------------------------
  // Firebase mode
  // ----------------------------------------------------------

  if (firebaseConfigured) {
    const q = query(
      collection(
        db,
        "users",
      ),
      where(
        "role",
        "==",
        role,
      ),
    );

    const snap =
      await getDocs(q);

    return snap.docs.map(
      (d) =>
        d.data() as UserProfile,
    );
  }

  // ----------------------------------------------------------
  // Local mode
  // ----------------------------------------------------------

  const users =
    lsRead<UserProfile[]>(
      LS_USERS,
      [],
    );

  const mock =
    lsRead<MockUserRecord[]>(
      "civicpulse.mockusers",
      [],
    );

  const mockProfiles:
    UserProfile[] =
    mock
      .filter(
        (u) =>
          u.role === role,
      )
      .map(
        (u) => ({
          uid: u.uid,
          email: u.email,
          name: u.name,
          role: u.role,
          createdAt: 0,
        }),
      );

  const merged =
    [
      ...users,
      ...mockProfiles,
    ].filter(
      (u) =>
        u.role === role,
    );

  // Deduplicate by UID
  const seen =
    new Set<string>();

  return merged.filter(
    (u) =>
      seen.has(u.uid)
        ? false
        : (seen.add(u.uid), true),
  );
}
