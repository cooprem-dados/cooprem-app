import React, { useEffect, useRef } from 'react';
import { Visit } from '../types';

declare const L: any;

interface VisitsMapProps { visits: Visit[]; }

const VisitsMap: React.FC<VisitsMapProps> = ({ visits }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([-15.793889, -47.882778], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(mapRef.current);
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);
  
  useEffect(() => {
      if (!mapRef.current) return;
      mapRef.current.eachLayer((layer: any) => { if (layer instanceof L.Marker) mapRef.current.removeLayer(layer); });

      const bounds: [number, number][] = [];
      visits.forEach(visit => {
          if (visit.location) {
              const diffTime = new Date().getTime() - new Date(visit.date).getTime();
              const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              let color = '#22c55e';
              if (daysAgo > 90) color = '#ef4444';
              else if (daysAgo >= 70) color = '#facc15';
              
              const icon = L.divIcon({
                  html: `<svg viewBox="0 0 24 24" class="w-8 h-8" fill="${color}" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 5.25 8.5 15.5 8.5 15.5s8.5-10.25 8.5-15.5C20.5 3.81 16.69 0 12 0zm0 11.5a3 3 0 110-6 3 3 0 010 6z"/></svg>`,
                  className: 'bg-transparent border-0',
                  iconSize: [32, 32],
                  iconAnchor: [16, 32],
                  popupAnchor: [0, -32],
              });

              L.marker([visit.location.latitude, visit.location.longitude], { icon })
                  .addTo(mapRef.current)
                  .bindPopup(`<b>${visit.cooperado.name}</b><br>${new Date(visit.date).toLocaleDateString('pt-BR')}`);
              bounds.push([visit.location.latitude, visit.location.longitude]);
          }
      });
      
      if (bounds.length > 0) mapRef.current.fitBounds(bounds, { padding: [50, 50] });
  }, [visits]);

  return <div ref={mapContainerRef} className="h-96 w-full z-0" />;
};
export default VisitsMap;