import React from 'react';
import { MapPin, Calendar, Tag, Package } from 'lucide-react';
import { ItemPost } from '../types';

interface ItemCardProps {
  item: ItemPost;
  onContact: (item: ItemPost) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onContact }) => {
  const isLost = item.type === 'LOST';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all mb-4">
      <div className="relative h-48 w-full bg-slate-200 dark:bg-slate-700">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">No Image</div>
        )}
        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold tracking-wide text-white ${isLost ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {isLost ? 'LOST' : 'FOUND'}
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
               <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 line-clamp-1">{item.title}</h3>
               {item.itemName && <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded w-fit mt-1">{item.itemName}</span>}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</span>
        </div>
        
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2 mt-2">{item.description}</p>
        
        <div className="space-y-2 mb-4">
            <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-indigo-500 dark:text-indigo-400" />
                {item.city}, {item.area}
            </div>
            <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                <Tag className="w-3.5 h-3.5 mr-1.5 text-indigo-500 dark:text-indigo-400" />
                {item.category}
            </div>
        </div>

        <button 
          onClick={() => onContact(item)}
          className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-indigo-600 dark:text-indigo-300 text-sm font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
        >
          Contact {isLost ? 'Owner' : 'Finder'}
        </button>
      </div>
    </div>
  );
};

export default ItemCard;