export type AxisTheme = "ai" | "industry";

const STORAGE_KEY = "internflow_axis_theme";
const COOKIE_NAME = "internflow_axis_theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function axisFromSpecialization(value?: string | null): AxisTheme | null {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("industry")) return "industry";
  if (normalized.includes("ai centre") || normalized.includes("artificial intelligence")) return "ai";
  return null;
}

export function getSavedAxisTheme(): AxisTheme | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "ai" || value === "industry" ? value : null;
}

export function applyAxisTheme(axis: AxisTheme) {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.axis = axis;
  window.localStorage.setItem(STORAGE_KEY, axis);
  document.cookie = `${COOKIE_NAME}=${axis}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent<AxisTheme>("internflow-axis-changed", { detail: axis }));
}

export function applySavedAxisTheme() {
  const axis = getSavedAxisTheme();
  if (axis) document.documentElement.dataset.axis = axis;
}
