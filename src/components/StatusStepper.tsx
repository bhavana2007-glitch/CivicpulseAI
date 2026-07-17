import { STATUS_FLOW, STATUS_LABEL, type ComplaintStatus } from "@/lib/types";

export function StatusStepper({ status }: { status: ComplaintStatus }) {
  const currentIdx = STATUS_FLOW.indexOf(status);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STATUS_FLOW.map((s, i) => {
        const active = i <= currentIdx;
        const current = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all ${
                current
                  ? "bg-amber text-navy shadow-md"
                  : active
                    ? "bg-moss/20 text-moss"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${current ? "bg-navy animate-pulse" : active ? "bg-moss" : "bg-border"}`}
              />
              {STATUS_LABEL[s]}
            </div>
            {i < STATUS_FLOW.length - 1 && (
              <div
                className={`h-px w-3 ${active ? "bg-moss" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
