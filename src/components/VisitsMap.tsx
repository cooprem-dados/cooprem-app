
import React, { useEffect, useRef } from 'react';
import { Visit } from '../types';
import L from 'leaflet';

const redMarkerIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width:16px;
      height:16px;
      background:#dc2626; /* vermelho */
      border:2px solid white;
      border-radius:9999px;
      box-shadow:0 2px 6px rgba(0,0,0,.4);
    "></div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

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
      if (v.location) {
        const marker = L.marker([v.location.latitude, v.location.longitude], { icon: redMarkerIcon })
          .bindPopup(`<b>${v.cooperado.name}</b><br>${v.summary}`)
          .addTo(mapRef.current!);
        bounds.push([v.location.latitude, v.location.longitude]);
      }
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
    }
  }, [visits]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default VisitsMap;
