import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { Complaint } from "@/lib/types";
import { STATUS_LABEL, statusColor } from "@/lib/map-status";

function FitBounds({ complaints }: { complaints: Complaint[] }) {
  const map = useMap();
  const key = complaints.map((c) => `${c.id}:${c.lat}:${c.lng}`).join("|");
  useEffect(() => {
    if (!complaints.length) return;
    const bounds = L.latLngBounds(
      complaints.map((c) => [c.lat, c.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function WardMap({
  complaints,
  height = 420,
}: {
  complaints: Complaint[];
  height?: number;
}) {
  const center = useMemo<[number, number]>(() => {
    if (!complaints.length) return [18.5204, 73.8567];
    const lat = complaints.reduce((a, c) => a + c.lat, 0) / complaints.length;
    const lng = complaints.reduce((a, c) => a + c.lng, 0) / complaints.length;
    return [lat, lng];
  }, [complaints]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: 12 }}
    >
      <TileLayer
        attribution="© OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds complaints={complaints} />
      {complaints.map((c) => {
        const color = statusColor(c.status);
        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng]}
            radius={10}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.7,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>{c.category}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  #{c.id.slice(-6)} · {new Date(c.createdAt).toLocaleString()}
                </div>
                <p style={{ margin: "6px 0", fontSize: 12 }}>{c.description}</p>
                {c.imageUrl && (
                  <img
                    src={c.imageUrl}
                    alt={`${c.category} report`}
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      marginBottom: 6,
                      maxHeight: 120,
                      objectFit: "cover",
                    }}
                  />
                )}
                <div style={{ fontSize: 11 }}>
                  <strong>Status:</strong> {STATUS_LABEL[c.status]}
                  <br />
                  <strong>Priority:</strong> {c.priority}
                  <br />
                  <strong>Citizen:</strong> {c.citizenName}
                  {c.assignedWorkerName && (
                    <>
                      <br />
                      <strong>Worker:</strong> {c.assignedWorkerName}
                    </>
                  )}
                  <br />
                  <strong>Location:</strong> {c.lat.toFixed(4)},{" "}
                  {c.lng.toFixed(4)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
