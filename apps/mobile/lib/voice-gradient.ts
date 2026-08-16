/**
 * Central voice button visual constants (PRD §6.1).
 *
 * The gradient base stop is `THEME.brand`; the two lighter stops are
 * brand-blue light extensions used only by this decorative button. Keeping
 * every color in this one file (rather than scattering hex in components)
 * satisfies §9.1「沿用现有 token，不新增颜色」. The overlay scrim / capsule
 * reuse the global black-scrim semantic (same as `bg-black/40` backdrops).
 */
import { THEME } from "@/lib/theme";

export const VOICE_GRADIENT_STOPS = [
  { offset: 0, color: THEME.light.brand },
  { offset: 0.5, color: "#3B6FFF" }, // brand light extension
  { offset: 1, color: "#5B8AFF" }, // brand light extension
];

/** Full-screen recording scrim — mirrors the global black/40 scrim. */
export const RECORDING_SCRIM = "rgba(0, 0, 0, 0.25)";

/** Top-banner capsule — darker so the white text stays readable. */
export const RECORDING_CAPSULE = "rgba(0, 0, 0, 0.55)";
