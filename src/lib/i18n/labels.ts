import { useTranslation } from "react-i18next";
import type { Category, ComplaintStatus, Priority } from "@/lib/types";

/** Slugify a canonical English category into a translation key. */
export function categoryKey(c: string) {
  return c.toLowerCase().replace(/\s+/g, "_");
}

/** Translated labels for enum-like values stored in English in the database. */
export function useLabels() {
  const { t } = useTranslation();
  return {
    t,
    status: (s: ComplaintStatus) => t(`status.${s}`),
    category: (c: Category | string) =>
      t(`category.${categoryKey(c)}`, { defaultValue: c }),
    priority: (p: Priority) => t(`priority.${p}`),
    role: (r: string) => t(`roles.${r}`, { defaultValue: r }),
  };
}
