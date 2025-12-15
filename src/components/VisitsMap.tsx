import React, { useEffect, useRef } from 'react';
import { Visit } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// CORREÇÃO: Usar URLs de CDN para os ícones evita erros de importação de imagens no Vite
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface VisitsMapProps { visits: Visit[]; }

const VisitsMap: React.FC<VisitsMapProps> = ({ visits }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([-15.793889, -47.882778], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        attribution: '&copy; OpenStreetMap contributors' 
      }).addTo(mapRef.current!);
    }
    
    // Cleanup ao desmontar
    return () => { 
      if (mapRef.current) { 
        mapRef.current.remove(); 
        mapRef.current = null; 
      } 
    };
  }, []);
  
  useEffect(() => {
      if (!mapRef.current) return;
      
      // Limpar marcadores antigos
      mapRef.current.eachLayer((layer) => { 
        if (layer instanceof L.Marker) {
          mapRef.current?.removeLayer(layer); 
        }
      });

      const bounds: [number, number][] = [];
      visits.forEach(visit => {
          if (visit.location) {
              const diffTime = new Date().getTime() - new Date(visit.date).getTime();
              const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              let color = '#22c55e'; // verde
              if (daysAgo > 90) color = '#ef4444'; // vermelho
              else if (daysAgo >= 70) color = '#facc15'; // amarelo
              
              // Ícone SVG personalizado para os pontos coloridos
              const svgIcon = L.divIcon({
                  html: `<svg viewBox="0 0 24 24" style="width: 32px; height: 32px; fill: ${color}; filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.4));" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 5.25 8.5 15.5 8.5 15.5s8.5-10.25 8.5-15.5C20.5 3.81 16.69 0 12 0zm0 11.5a3 3 0 110-6 3 3 0 010 6z"/></svg>`,
                  className: 'bg-transparent border-0',
                  iconSize: [32, 42],
                  iconAnchor: [16, 42],
                  popupAnchor: [0, -42],
              });

              L.marker([visit.location.latitude, visit.location.longitude], { icon: svgIcon })
                  .addTo(mapRef.current!)
                  .bindPopup(`<b>${visit.cooperado.name || 'Cooperado'}</b><br>${new Date(visit.date).toLocaleDateString('pt-BR')}`);
              bounds.push([visit.location.latitude, visit.location.longitude]);
          }
      });
      
      if (bounds.length > 0) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
  }, [visits]);

  return <div ref={mapContainerRef} className="h-96 w-full z-0 rounded-lg shadow-inner" />;
};

export default VisitsMap;