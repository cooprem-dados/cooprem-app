import React from 'react';
import { Visit } from '../types';

const VisitListItem: React.FC<{ visit: Visit }> = ({ visit }) => {
  return (
    <li className="py-4 border-b">
      <div className="flex flex-col md:flex-row justify-between">
        <div>
          <h3 className="font-semibold text-blue-700">{visit.cooperado.name}</h3>
          <p className="text-sm text-gray-500">{new Date(visit.date).toLocaleDateString('pt-BR')}</p>
          <p className="text-gray-700">{visit.summary}</p>
        </div>
        <div className="text-right">
          <div className="flex flex-wrap gap-1 justify-end mt-2">
            {visit.products.map((p, i) => (<span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{p.product}</span>))}
          </div>
          {visit.location && (<a href={`https://www.google.com/maps/search/?api=1&query=${visit.location.latitude},${visit.location.longitude}`} target="_blank" className="text-sm text-blue-500 hover:underline">Ver Local</a>)}
        </div>
      </div>
    </li>
  );
};
export default VisitListItem;