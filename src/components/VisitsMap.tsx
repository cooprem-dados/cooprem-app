import React, { useEffect, useRef } from 'react';
import { Visit } from '../types';
import L from 'leaflet';

function toDate(value: any): Date {
  if (value instanceof Date) return value;
  // Firestore Timestamp shape: { seconds, nanoseconds }
  if (value && typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return new Date(value);
}

function formatDatePtBR(d: Date): string {
  return d.toLocaleDateString('pt-BR');
}

function daysAgo(d: Date): number {
  const now = new Date();
  // Normaliza para "meia-noite" para não variar por horas
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffMs = startOfToday - startOfThatDay;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function relativeDaysFromNow(d: Date): string {
  const diffDays = daysAgo(d);
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  return `há ${diffDays} dias`;
}

// Ícones por faixa de "dias atrás"
function markerIconForDays(diffDays: number): L.DivIcon {
  // < 70 = verde | 71-90 = amarelo | > 90 = vermelho
  const color = diffDays <= 70 ? '#16a34a' : (diffDays <= 90 ? '#f59e0b' : '#dc2626');

  return L.divIcon({
    className: '',
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

interface VisitsMapProps { visits: Visit[]; }

const VisitsMap: React.FC<VisitsMapProps> = ({ visits }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView([-18.9186, -48.2772], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Limpar marcadores
    mapRef.current.eachLayer(layer => {
      if (layer instanceof L.Marker) mapRef.current?.removeLayer(layer);
    });

    const bounds: L.LatLngExpression[] = [];

    visits.forEach(v => {
      if (!v.location) return;

      const dt = toDate((v as any).date);
      const diffDays = daysAgo(dt);

      const cooperadoName = (v.cooperado as any)?.name ?? '—';
      const gerenteName = (v.manager as any)?.name ?? '—';
      const dtStr = formatDatePtBR(dt);
      const rel = relativeDaysFromNow(dt);

      const popupHtml = `
        <div style="min-width: 220px">
          <div style="font-weight: 700; margin-bottom: 6px;">${cooperadoName}</div>
          <div style="margin-bottom: 6px;">
            <div><b>Gerente:</b> ${gerenteName}</div>
            <div><b>Data:</b> ${dtStr} <span style="opacity:.75">(${rel})</span></div>
          </div>
          <div style="opacity:.9; white-space: pre-wrap;">${(v.summary ?? '').toString()}</div>
        </div>
      `;

      const marker = L.marker([v.location.latitude, v.location.longitude], {
        icon: markerIconForDays(diffDays),
      })
        .bindPopup(popupHtml)
        .addTo(mapRef.current!);

      bounds.push([v.location.latitude, v.location.longitude]);
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
    }
  }, [visits]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default VisitsMap;
