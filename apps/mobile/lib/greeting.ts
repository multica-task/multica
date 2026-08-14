/**
 * Home header greeting for the current hour (device-local). Pure so the
 * hour→copy mapping is unit-testable without mocking Date.
 *
 * PRD §9.5: mobile copy is Chinese only; this is the home header greeting
 * ("早上好，Sun" / "下午好" / "晚上好").
 */
export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "早上好";
  if (hour >= 12 && hour < 18) return "下午好";
  return "晚上好";
}
