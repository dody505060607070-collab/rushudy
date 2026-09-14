import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [26.3536, 43.9667];

export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const point: [number, number] =
        latitude != null && longitude != null ? [latitude, longitude] : DEFAULT_CENTER;
      const map = L.map(containerRef.current, { zoomControl: false }).setView(point, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      const icon = L.divIcon({
        className: "property-picker-marker",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: '<span class="block size-[34px] rounded-full border-4 border-primary-foreground bg-primary shadow-float"></span>',
      });
      const marker = L.marker(point, { draggable: true, icon }).addTo(map);
      marker.on("dragend", () => {
        const next = marker.getLatLng();
        onChange(Number(next.lat.toFixed(7)), Number(next.lng.toFixed(7)));
      });
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(event.latlng);
        onChange(Number(event.latlng.lat.toFixed(7)), Number(event.latlng.lng.toFixed(7)));
      });
      mapRef.current = map;
      markerRef.current = marker;
      window.setTimeout(() => map.invalidateSize(), 100);
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || latitude == null || longitude == null) return;
    markerRef.current?.setLatLng([latitude, longitude]);
    mapRef.current?.panTo([latitude, longitude]);
  }, [latitude, longitude, ready]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-xl border border-border bg-muted" />
      <p className="text-[12px] text-muted-foreground">اضغط على الخريطة أو اسحب العلامة لتحديد موقع العقار بدقة.</p>
    </div>
  );
}