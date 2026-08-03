/**
 * Haversine formula to calculate the distance between two GPS coordinates in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Checks if a given location is within allowed radius from office location.
 */
export function isWithinOfficeRadius(
  staffLat: number,
  staffLon: number,
  officeLat: number,
  officeLon: number,
  radiusMeters: number = 500
): { isWithin: boolean; distanceMeters: number } {
  const distanceMeters = calculateDistanceMeters(staffLat, staffLon, officeLat, officeLon);
  return {
    isWithin: distanceMeters <= radiusMeters,
    distanceMeters,
  };
}
