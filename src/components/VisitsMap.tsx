import React, { useEffect, useRef } from "react";
import { Visit } from "../types";
import L from "leaflet";

function toDate(value: any): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  return new Date(value);
}

function formatDatePtBR(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

function daysAgo(d: Date): number {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffMs = startOfToday - startOfThatDay;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function relativeDaysFromNow(d: Date): string {
  const diffDays = daysAgo(d);
  if (diffDays <= 0) return "hoje";
  if (diffDays === 1) return "há 1 dia";
  return `há ${diffDays} dias`;
}

function markerIconForDays(diffDays: number): L.DivIcon {
  const color = diffDays <= 70 ? "#16a34a" : diffDays <= 90 ? "#f59e0b" : "#dc2626";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:16px;
        height:16px;
        background:${color};
        border:2px solid white;
        border-radius:9999px;
        box-shadow:0 2px 6px rgba(0,0,0,.4);
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

interface VisitsMapProps {
  visits: Visit[];
}

const VisitsMap: React.FC<VisitsMapProps> = ({ visits }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView([-18.9186, -48.2772], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // limpar markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) mapRef.current?.removeLayer(layer);
    });

    const bounds: L.LatLngExpression[] = [];

    visits.forEach((v: any) => {
      const loc = v?.location;
      const lat = loc?.latitude;
      const lng = loc?.longitude;
      if (lat == null || lng == null) return;

      const dt = toDate(v?.date);
      const diffDays = daysAgo(dt);

      const cooperadoName = (v?.cooperado?.name ?? "—").toString();
      const gerenteName = (v?.manager?.name ?? v?.cooperado?.managerName ?? "—").toString();

      const dtStr = formatDatePtBR(dt);
      const rel = relativeDaysFromNow(dt);

      const popupHtml = `
        <div style="min-width: 220px">
          <div style="font-weight: 700; margin-bottom: 6px;">${cooperadoName}</div>
          <div style="margin-bottom: 6px;">
            <div><b>Gerente:</b> ${gerenteName}</div>
            <div><b>Última visita:</b> ${dtStr} <span style="opacity:.75">(${rel})</span></div>
            <div><b>Dias:</b> ${diffDays}</div>
          </div>
          <div style="opacity:.9; white-space: pre-wrap;">${(v?.summary ?? "").toString()}</div>
        </div>
      `;

      L.marker([lat, lng], { icon: markerIconForDays(diffDays) })
        .bindPopup(popupHtml)
        .addTo(mapRef.current!);

      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
    }
  }, [visits]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default VisitsMap;