export function showRoseBadge(name: string, isFemale: boolean): boolean {
  return isFemale && !name.includes('🌹');
}
