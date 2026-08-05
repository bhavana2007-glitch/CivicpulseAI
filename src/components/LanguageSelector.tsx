import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, getStoredLanguage, setLanguage, type LanguageCode } from "@/lib/i18n";

/**
 * Header language selector. `tone="dark"` renders for dark (navy) headers.
 */
export function LanguageSelector({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { i18n } = useTranslation();
  const [value, setValue] = useState<LanguageCode>("en");

  useEffect(() => {
    const stored = getStoredLanguage();
    setValue(stored);
    if (stored !== i18n.language) setLanguage(stored);
  }, [i18n]);

  const cls =
    tone === "dark"
      ? "border-cream/30 bg-transparent text-cream"
      : "border-navy/30 bg-background text-navy";

  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={value}
        onChange={(e) => {
          const code = e.target.value as LanguageCode;
          setValue(code);
          setLanguage(code);
        }}
        className={`rounded border px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest outline-none transition-colors focus:ring-2 focus:ring-amber/40 ${cls}`}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="text-navy">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
