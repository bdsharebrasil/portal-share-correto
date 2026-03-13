import React from 'react';
import { LucideIcon } from 'lucide-react';
interface CircularNavButtonProps {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  color: 'blue' | 'purple' | 'green' | 'amber';
  isActive: boolean;
}
export function CircularNavButton({
  onClick,
  icon,
  label,
  color,
  isActive
}: CircularNavButtonProps) {
  const Icon = icon;
  const getColorClasses = () => {
    switch (color) {
      case 'blue':
        return isActive ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400';
      case 'purple':
        return isActive ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-purple-500 hover:text-purple-400';
      case 'green':
        return isActive ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-emerald-500 hover:text-emerald-400';
      case 'amber':
        return isActive ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_10px_rgba(217,119,6,0.5)]' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-amber-500 hover:text-amber-400';
      default:
        return 'bg-gray-800 border-gray-700';
    }
  };
  return <button onClick={onClick} className="flex flex-col items-center gap-3 group transition-all duration-300 py-[2px]">
      <div className={`
          w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-2 
          transition-all duration-300 transform group-hover:scale-90
          ${getColorClasses()}
        `}>
        <Icon size={28} strokeWidth={2} />
      </div>
      <span className={`text-sm font-medium transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
        {label}
      </span>
    </button>;
}