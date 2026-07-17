import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Complaint } from "@/lib/types";

// Fix default marker icons in bundler
const icon = L.icon({
  iconUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Props {
  complaints: Complaint[];
  center?: [number, number];
  height?: number;
}

export function ComplaintMap({
  complaints,
  center = [18.5204, 73.8567],
  height = 380,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const m = L.map(ref.current).setView(center, 12);
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap", maxZoom: 19 },
    ).addTo(m);
    layerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!layerRef.current || !mapRef.current) return;
    layerRef.current.clearLayers();
    complaints.forEach((c) => {
      const priorityColor = {
        low: "#4a7c59",
        medium: "#f5b643",
        high: "#e07a3f",
        critical: "#c94a4a",
      }[c.priority];
      L.circleMarker([c.lat, c.lng], {
        radius: 9,
        color: priorityColor,
        fillColor: priorityColor,
        fillOpacity: 0.65,
        weight: 2,
      })
        .bindPopup(
          `<strong>${c.category}</strong><br/>${c.description.slice(0, 80)}…<br/><em>${c.status}</em>`,
        )
        .addTo(layerRef.current!);
    });
  }, [complaints]);

  return (
    <div
      ref={ref}
      style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }}
    />
  );
}
