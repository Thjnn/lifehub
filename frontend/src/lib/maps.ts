// Spec §15.5: open a place in the phone's maps app via a plain URL — no Maps API (Google's needs a billing card).
// On phones this link opens the Google Maps app when installed, otherwise the web map.
export const mapsUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
