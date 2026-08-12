import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { DashShell } from "@/components/DashShell";
import { StatusStepper } from "@/components/StatusStepper";
import { useAuth } from "@/lib/auth-context";
import {
  createComplaint,
  subscribeComplaints,
  uploadImage,
  uploadVoice,
} from "@/lib/complaints";
import VoiceRecorder from "@/components/VoiceRecorder";
import { useLabels } from "@/lib/i18n/labels";
import { analyzeImage, findDuplicate, type AIAnalysis } from "@/lib/mock-ai";
import { CATEGORIES, departmentFor } from "@/lib/categories";
import type { Category, Complaint } from "@/lib/types";

export const Route = createFileRoute("/citizen")({
  component: () => (
    <RoleGuard role="citizen">
      <CitizenDashboard />
    </RoleGuard>
  ),
});

function CitizenDashboard() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<Complaint[]>([]);

  useEffect(() => {
    if (!user) return;

    return subscribeComplaints(setComplaints, {
      role: "citizen",
      uid: user.uid,
    });
  }, [user]);

  return (
    <DashShell role="citizen">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold uppercase text-navy">
          {t("citizen.welcome", {
            name: profile?.name ?? t("roles.citizen"),
          })}
        </h1>

        <p className="text-sm text-muted-foreground">
          {t("citizen.subtitle")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <ReportForm existing={complaints} />

        <div className="bento">
          <h2 className="font-display text-lg font-bold uppercase text-navy">
            {t("citizen.myComplaints", {
              count: complaints.length,
            })}
          </h2>

          <div className="mt-4 max-h-[600px] space-y-3 overflow-y-auto pr-2">
            {complaints.length === 0 && (
              <p className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("citizen.empty")}
              </p>
            )}

            {complaints.map((c) => (
              <ComplaintCard key={c.id} c={c} />
            ))}
          </div>
        </div>
      </div>
    </DashShell>
  );
}

function ComplaintCard({ c }: { c: Complaint }) {
  const { t } = useTranslation();
  const { category } = useLabels();

  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            #{c.id.slice(-6)} ·{" "}
            {new Date(c.createdAt).toLocaleString()}
          </div>

          <div className="font-display text-sm font-bold text-navy">
            {category(c.category)}
          </div>
        </div>

        <PriorityBadge p={c.priority} />
      </div>

      {/* IMAGE */}
      {c.imageUrl && (
        <img
          src={c.imageUrl}
          alt="Civic issue"
          className="mb-2 h-32 w-full rounded object-cover"
        />
      )}

      {/* VOICE */}
      {c.voiceUrl && (
        <div className="mb-3 rounded border border-border bg-background p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            🎙️ Voice Complaint
          </div>

          <audio
            controls
            preload="metadata"
            src={c.voiceUrl}
            className="w-full"
          />
        </div>
      )}

      <p className="mb-3 text-xs text-muted-foreground">
        {c.description}
      </p>

      <StatusStepper status={c.status} />

      {c.status === "completed" && c.proofUrl && (
        <div className="mt-2">
          <div className="font-mono text-[10px] uppercase text-moss">
            {t("citizen.proof")}
          </div>

          <img
            src={c.proofUrl}
            alt="Proof"
            className="mt-1 h-24 rounded object-cover"
          />
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ p }: { p: Complaint["priority"] }) {
  const { priority } = useLabels();

  const c = {
    low: "bg-moss/20 text-moss",
    medium: "bg-amber/30 text-navy",
    high: "bg-orange-200 text-orange-900",
    critical: "bg-destructive/20 text-destructive",
  }[p];

  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${c}`}
    >
      {priority(p)}
    </span>
  );
}

function ReportForm({ existing }: { existing: Complaint[] }) {
  const { user, profile } = useAuth();
  const { t } = useTranslation();

  const {
    category: categoryLabel,
    priority: priorityLabel,
    status: statusLabel,
  } = useLabels();

  const fileRef = useRef<HTMLInputElement>(null);

  /* =========================
     FORM STATE
  ========================= */

  const [imageData, setImageData] = useState<string | null>(null);

  const [voiceRecording, setVoiceRecording] =
    useState<Blob | null>(null);

  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [ai, setAi] = useState<AIAnalysis | null>(null);

  const [analyzing, setAnalyzing] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [status, setStatus] = useState<string | null>(null);

  const [dup, setDup] = useState<Complaint | null>(null);

  const [manualCategory, setManualCategory] =
    useState<Category | "">("");

  /* =========================
     FINAL CATEGORY
  ========================= */

  const finalCategory: Category | null =
    manualCategory || ai?.category || null;

  /* =========================
     GPS
  ========================= */

  function detectGPS() {
    setStatus(t("citizen.detectingGps"));

    if (!navigator.geolocation) {
      const lat =
        18.5204 + (Math.random() - 0.5) * 0.05;

      const lng =
        73.8567 + (Math.random() - 0.5) * 0.05;

      setCoords({ lat, lng });

      setStatus(t("citizen.gpsUnavailable"));

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });

        setStatus(t("citizen.gpsDetected"));
      },

      () => {
        const lat =
          18.5204 + (Math.random() - 0.5) * 0.05;

        const lng =
          73.8567 + (Math.random() - 0.5) * 0.05;

        setCoords({ lat, lng });

        setStatus(t("citizen.gpsBlocked"));
      },
    );
  }

  /* =========================
     IMAGE HANDLING
  ========================= */

  async function onFile(f: File) {
    const reader = new FileReader();

    reader.onload = async () => {
      const url = reader.result as string;

      /*
       * If user uploads an image,
       * clear previous voice-only category selection.
       */
      setImageData(url);
      setVoiceRecording(null);
      setAi(null);
      setManualCategory("");
      setDup(null);
      setAnalyzing(true);

      const result = await analyzeImage(url);

      setAi(result);
      setAnalyzing(false);

      if (!coords) {
        detectGPS();
      }
    };

    reader.readAsDataURL(f);
  }

  /* =========================
     DUPLICATE DETECTION
  ========================= */

  useEffect(() => {
    if (ai && coords) {
      const d = findDuplicate(
        ai.imageHash,
        coords.lat,
        coords.lng,
        existing,
      );

      setDup(d);
    }
  }, [ai, coords, existing]);

  /* =========================
     VOICE RECORDER CALLBACK
  ========================= */

  function handleVoiceRecording(blob: Blob) {
    /*
     * Voice is an alternative to image.
     */
    setVoiceRecording(blob);

    /*
     * Clear image AI state because
     * this is now a voice-based complaint.
     */
    setImageData(null);
    setAi(null);
    setManualCategory("");
    setDup(null);
    setAnalyzing(false);

    /*
     * Automatically detect GPS.
     */
    if (!coords) {
      detectGPS();
    }

    setStatus(
      "Voice complaint recorded successfully. Please select the complaint category and submit.",
    );
  }

  /* =========================
     SUBMIT COMPLAINT
  ========================= */

  async function submit() {
    if (!user || !profile || !coords) {
      setStatus(
        "Please detect your location before submitting.",
      );
      return;
    }

    /*
     * Citizen must provide either
     * an image OR a voice recording.
     */
    if (!imageData && !voiceRecording) {
      setStatus(
        "Please upload an image or record a voice complaint.",
      );
      return;
    }

    /*
     * Image complaints require AI analysis.
     */
    if (imageData && (!ai || !finalCategory)) {
      setStatus(
        "Please wait for AI image analysis to complete.",
      );
      return;
    }

    /*
     * Voice-only complaints currently
     * require manual category selection.
     */
    if (
      voiceRecording &&
      !imageData &&
      !manualCategory
    ) {
      setStatus(
        "Please select the complaint category for your voice complaint.",
      );
      return;
    }

    /*
     * Uncertain AI result requires manual category.
     */
    if (ai?.uncertain && !manualCategory) {
      setStatus(
        "Please select the correct complaint category.",
      );
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl: string | undefined;

      let voiceUrl: string | undefined;

      /* =========================
         UPLOAD IMAGE
      ========================= */

      if (imageData) {
        setStatus(t("citizen.uploading"));

        imageUrl = await uploadImage(
          `complaints/${user.uid}/${Date.now()}.jpg`,
          imageData,
        );
      }

      /* =========================
         UPLOAD VOICE
      ========================= */

      if (voiceRecording) {
        setStatus(
          "Uploading voice complaint...",
        );

        voiceUrl = await uploadVoice(
          `complaints/${user.uid}/${Date.now()}.webm`,
          voiceRecording,
        );
      }

      setStatus(
        t("citizen.submittingStatus"),
      );

      const category = finalCategory;

      if (!category) {
        setStatus(
          "Please select a complaint category.",
        );

        setSubmitting(false);

        return;
      }

      /*
       * IMAGE COMPLAINT
       *
       * Uses AI-generated description.
       *
       * VOICE-ONLY COMPLAINT
       *
       * Uses a temporary description until
       * speech-to-text + AI analysis is connected.
       */

      const description =
        ai?.description ??
        "Citizen submitted a voice complaint. Voice recording attached for authority review.";

      const priority =
        ai?.priority ?? "medium";

      const severity =
        ai?.severity ?? "Medium";

      await createComplaint({
        citizenId: user.uid,

        citizenName: profile.name,

        category,

        description,

        imageUrl,

        voiceUrl,

        lat: coords.lat,

        lng: coords.lng,

        priority,

        severity,

        department: departmentFor(category),

        aiCategory:
          ai?.category ?? undefined,

        aiConfidence:
          ai?.confidence,

        manualOverride: ai
          ? category !== ai.category
          : true,
      });

      /* =========================
         SUCCESS
      ========================= */

      setStatus(
        "Complaint submitted successfully!",
      );

      /* RESET FORM */

      setImageData(null);

      setVoiceRecording(null);

      setAi(null);

      setManualCategory("");

      setCoords(null);

      setDup(null);

      setAnalyzing(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    } catch (error) {
      console.error(
        "Complaint submission error:",
        error,
      );

      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to submit complaint. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================
     UI
  ========================= */

  return (
    <div className="bento">
      <h2 className="font-display text-lg font-bold uppercase text-navy">
        {t("citizen.reportTitle")}
      </h2>

      <p className="mb-4 text-xs text-muted-foreground">
        {t("citizen.reportSubtitle")}
      </p>

      <div className="space-y-4">

        {/* =====================
            IMAGE UPLOAD
        ===================== */}

        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("citizen.stepImage")}
          </label>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f =
                e.target.files?.[0];

              if (f) {
                onFile(f);
              }
            }}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-navy file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:uppercase file:tracking-widest file:text-cream"
          />

          {imageData && (
            <img
              src={imageData}
              alt="Civic issue preview"
              className="mt-2 h-40 w-full rounded object-cover"
            />
          )}
        </div>

        {/* =====================
            OR DIVIDER
        ===================== */}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />

          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            OR
          </span>

          <div className="h-px flex-1 bg-border" />
        </div>

        {/* =====================
            VOICE RECORDER
        ===================== */}

        <div className="rounded-lg border border-border bg-background/50 p-3">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            🎙️ Voice Complaint
          </label>

          <VoiceRecorder
            onRecordingComplete={
              handleVoiceRecording
            }
          />

          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Don't know how to capture the issue?
            Simply speak and describe the problem.
            Your voice recording will be attached
            to the complaint.
          </p>
        </div>

        {/* =====================
            VOICE CATEGORY
        ===================== */}

        {voiceRecording &&
          !imageData &&
          !ai && (
            <div className="rounded-lg border border-amber/40 bg-amber/10 p-3">
              <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-navy">
                Complaint Category
              </label>

              <select
                value={manualCategory}
                onChange={(e) =>
                  setManualCategory(
                    e.target.value as
                      | Category
                      | "",
                  )
                }
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs uppercase"
              >
                <option value="">
                  Select complaint category
                </option>

                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-muted-foreground">
                Voice-to-AI classification will be
                connected in the next stage. For
                now, select the issue type manually.
              </p>
            </div>
          )}

        {/* =====================
            GPS
        ===================== */}

        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("citizen.stepGps")}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={detectGPS}
              className="rounded-md border border-navy px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-navy hover:bg-navy/5"
            >
              {t("citizen.detectGps")}
            </button>

            {coords && (
              <span className="font-mono text-xs text-moss">
                📍{" "}
                {coords.lat.toFixed(4)},{" "}
                {coords.lng.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        {/* =====================
            AI ANALYSIS
        ===================== */}

        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("citizen.stepAi")}
          </label>

          {analyzing && (
            <div className="rounded border border-amber/40 bg-amber/10 p-3 font-mono text-xs text-navy">
              {t("citizen.analyzing")}
            </div>
          )}

          {ai && !analyzing && (
            <div
              className={`space-y-2 rounded-lg border p-3 ${
                ai.uncertain
                  ? "border-amber/50 bg-amber/10"
                  : "border-moss/40 bg-moss/5"
              }`}
            >

              {imageData && (
                <img
                  src={imageData}
                  alt="Uploaded civic issue preview"
                  className="h-28 w-full rounded object-cover"
                />
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold text-navy">
                  {finalCategory
                    ? categoryLabel(
                        finalCategory,
                      )
                    : t(
                        "citizen.classificationFailed",
                      )}
                </span>

                <span className="font-mono text-[10px] uppercase text-moss">
                  {t("citizen.confidence", {
                    value: (
                      ai.confidence * 100
                    ).toFixed(0),
                  })}
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
                {ai.description}
              </div>

              {ai.error && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  {t(
                    "citizen.classificationError",
                    {
                      reason: ai.error,
                    },
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 font-mono text-[10px] uppercase">

                <span className="rounded bg-navy/10 px-2 py-0.5">
                  {t("common.department")}:{" "}
                  {ai.department}
                </span>

                <span className="rounded bg-amber/20 px-2 py-0.5">
                  {t(
                    "common.priorityLabel",
                  )}:{" "}
                  {priorityLabel(
                    ai.priority,
                  )}
                </span>

                <span className="rounded bg-navy/10 px-2 py-0.5">
                  {t("citizen.severity")}:{" "}
                  {ai.severity}
                </span>

                {!ai.uncertain && (
                  <span className="rounded bg-moss/20 px-2 py-0.5 text-moss">
                    {t("citizen.valid")}
                  </span>
                )}
              </div>

              {/* UNCERTAIN AI */}

              {ai.uncertain && (
                <div className="space-y-2 rounded border border-amber/50 bg-background/60 p-2">

                  <p className="text-xs font-semibold text-navy">
                    {t(
                      "citizen.uncertain",
                    )}
                  </p>

                  <select
                    value={manualCategory}
                    onChange={(e) =>
                      setManualCategory(
                        e.target.value as
                          | Category
                          | "",
                      )
                    }
                    className="w-full rounded border border-input bg-background px-2 py-1.5 font-mono text-[11px] uppercase"
                  >
                    <option value="">
                      {t(
                        "citizen.chooseCategory",
                      )}
                    </option>

                    {CATEGORIES.map(
                      (c) => (
                        <option
                          key={c}
                          value={c}
                        >
                          {categoryLabel(c)}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              )}

              {/* DUPLICATE */}

              {dup && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  {t(
                    "citizen.duplicate",
                    {
                      id: dup.id.slice(
                        -6,
                      ),
                      status:
                        statusLabel(
                          dup.status,
                        ),
                    },
                  )}
                </div>
              )}
            </div>
          )}

          {/* VOICE SUCCESS */}

          {voiceRecording &&
            !imageData && (
              <div className="mt-2 rounded border border-moss/40 bg-moss/5 p-3 text-xs text-moss">
                🎙️ Voice complaint recorded
                successfully.
                <br />
                Select the complaint category
                above and submit.
              </div>
            )}
        </div>

        {/* =====================
            STATUS
        ===================== */}

        {status && (
          <div className="rounded border border-border bg-background/60 px-3 py-2 font-mono text-xs text-navy">
            {status}
          </div>
        )}

        {/* =====================
            SUBMIT BUTTON
        ===================== */}

        <button
          type="button"
          disabled={
            (!ai && !voiceRecording) ||
            !coords ||
            submitting ||
            (ai?.uncertain &&
              !manualCategory)
          }
          onClick={submit}
          className="w-full rounded-md bg-moss px-4 py-3 font-mono text-xs font-semibold uppercase tracking-widest text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting
            ? t("citizen.submitting")
            : t("citizen.submit")}
        </button>

      </div>
    </div>
  );
}
