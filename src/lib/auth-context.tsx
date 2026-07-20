import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase";
import type { Role, UserProfile } from "./types";

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  firebaseReady: boolean;
  register: (
    email: string,
    password: string,
    name: string,
    role: Role,
  ) => Promise<void>;
  login: (email: string, password: string, expectedRole: Role) => Promise<void>;
  logout: () => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// ---------- Mock fallback for development without Firebase ----------
const MOCK_USERS_KEY = "civicpulse.mockusers";
const MOCK_SESSION_KEY = "civicpulse.mocksession";

interface MockUser {
  uid: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  emailVerified: boolean;
}

function readMockUsers(): MockUser[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MOCK_USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeMockUsers(u: MockUser[]) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(u));
}

const DEMO_SEED: MockUser[] = [
  {
    uid: "demo_citizen",
    email: "citizen@demo.com",
    password: "demo1234",
    name: "Demo Citizen",
    role: "citizen",
    emailVerified: true,
  },
  {
    uid: "demo_authority",
    email: "authority@demo.com",
    password: "demo1234",
    name: "Demo Authority",
    role: "authority",
    emailVerified: true,
  },
  {
    uid: "demo_worker",
    email: "worker@demo.com",
    password: "demo1234",
    name: "Demo Worker",
    role: "worker",
    emailVerified: true,
  },
];

function seedDemoUsers() {
  if (typeof window === "undefined") return;
  const existing = readMockUsers();
  const emails = new Set(existing.map((u) => u.email));
  const merged = [...existing];
  let added = false;
  for (const d of DEMO_SEED) {
    if (!emails.has(d.email)) {
      merged.push(d);
      added = true;
    }
  }
  if (added) writeMockUsers(merged);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User) => {
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) setProfile(snap.data() as UserProfile);
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      seedDemoUsers();
      // mock session
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(MOCK_SESSION_KEY)
          : null;
      if (raw) {
        try {
          const s = JSON.parse(raw);
          setUser({
            uid: s.uid,
            email: s.email,
            emailVerified: s.emailVerified,
          } as User);
          setProfile(s.profile);
        } catch {
          /* noop */
        }
      }
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await loadProfile(u);
      else setProfile(null);
      setLoading(false);
    });
    return unsub;
  }, [loadProfile]);

  const register = useCallback<AuthCtx["register"]>(
    async (email, password, name, role) => {
      if (!firebaseConfigured) {
        const users = readMockUsers();
        if (users.some((u) => u.email === email))
          throw new Error("Email already registered");
        const mu: MockUser = {
          uid: `mock_${Date.now()}`,
          email,
          password,
          name,
          role,
          emailVerified: false,
        };
        users.push(mu);
        writeMockUsers(users);
        throw new Error(
          "MOCK_UNVERIFIED:Account created. In demo mode, please click 'Resend verification' then log in — verification auto-completes.",
        );
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const prof: UserProfile = {
        uid: cred.user.uid,
        email,
        name,
        role,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "users", cred.user.uid), prof);
      await sendEmailVerification(cred.user);
      await signOut(auth);
    },
    [],
  );

  const login = useCallback<AuthCtx["login"]>(
    async (email, password, expectedRole) => {
      if (!firebaseConfigured) {
        const users = readMockUsers();
        const mu = users.find(
          (u) => u.email === email && u.password === password,
        );
        if (!mu) throw new Error("Invalid credentials");
        if (!mu.emailVerified)
          throw new Error("Please verify your email before logging in.");
        if (mu.role !== expectedRole)
          throw new Error(
            `This account is registered as ${mu.role}, not ${expectedRole}.`,
          );
        const profile: UserProfile = {
          uid: mu.uid,
          email: mu.email,
          name: mu.name,
          role: mu.role,
          createdAt: Date.now(),
        };
        localStorage.setItem(
          MOCK_SESSION_KEY,
          JSON.stringify({
            uid: mu.uid,
            email: mu.email,
            emailVerified: true,
            profile,
          }),
        );
        setUser({
          uid: mu.uid,
          email: mu.email,
          emailVerified: true,
        } as User);
        setProfile(profile);
        return;
      }
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await cred.user.reload();
      if (!cred.user.emailVerified) {
        await signOut(auth);
        throw new Error("Please verify your email before logging in.");
      }
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        throw new Error("No profile found. Please register again.");
      }
      const prof = snap.data() as UserProfile;
      if (prof.role !== expectedRole) {
        await signOut(auth);
        throw new Error(
          `This account is registered as ${prof.role}, not ${expectedRole}.`,
        );
      }
      setProfile(prof);
    },
    [],
  );

  const logout = useCallback(async () => {
    if (!firebaseConfigured) {
      localStorage.removeItem(MOCK_SESSION_KEY);
      setUser(null);
      setProfile(null);
      return;
    }
    await signOut(auth);
  }, []);

  const resendVerification = useCallback(async () => {
    if (!firebaseConfigured) {
      // in mock mode: mark most recent unverified user as verified
      const users = readMockUsers();
      const idx = [...users].reverse().findIndex((u) => !u.emailVerified);
      if (idx >= 0) {
        users[users.length - 1 - idx].emailVerified = true;
        writeMockUsers(users);
      }
      return;
    }
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (firebaseConfigured && auth.currentUser) {
      await auth.currentUser.reload();
      setUser(auth.currentUser);
      await loadProfile(auth.currentUser);
    }
  }, [loadProfile]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      profile,
      loading,
      firebaseReady: firebaseConfigured,
      register,
      login,
      logout,
      resendVerification,
      refreshUser,
    }),
    [
      user,
      profile,
      loading,
      register,
      login,
      logout,
      resendVerification,
      refreshUser,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
