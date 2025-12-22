
import React from 'react';
import { Visit } from '../types';

const VisitListItem: React.FC<{ visit: Visit }> = ({ visit }) => {
  return (
    <div className="p-4 hover:bg-gray-50 flex justify-between items-center border-b last:border-0">
      <div className="flex-1">
        <h4 className="font-bold text-[#005058]">{visit.cooperado.name}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">
            {new Date(visit.date).toLocaleDateString('pt-BR')}
          </span>
          {visit.location && (
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${visit.location.latitude},${visit.location.longitude}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-[10px] text-blue-600 hover:underline flex items-center"
            >
              📍 Ver Mapa
            </a>
          )}
        </div>
        <p className="text-sm text-gray-700 mt-2 line-clamp-2">{visit.summary}</p>
      </div>
      <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
        {visit.products.map((p, i) => (
          <span key={i} className="text-[9px] bg-[#005058]/10 text-[#005058] px-2 py-0.5 rounded-full font-bold uppercase">
            {p.product}
          </span>
        ))}
      </div>
    </div>
  );
};

export default VisitListItem;
