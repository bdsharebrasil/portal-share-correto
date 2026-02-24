import React from 'react'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: 'blue' | 'orange' | 'purple' | 'green'
  subtext?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtext,
}: StatCardProps) {
  const getColors = () => {
    switch (color) {
      case 'blue':
        return 'text-blue-400 bg-blue-400/10'
      case 'orange':
        return 'text-orange-400 bg-orange-400/10'
      case 'purple':
        return 'text-purple-400 bg-purple-400/10'
      case 'green':
        return 'text-emerald-400 bg-emerald-400/10'
    }
  }

  const colorClass = getColors()

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-between hover:border-gray-700 transition-colors">
      <div>
        <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
        <div className="text-3xl font-bold text-white">{value}</div>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </div>
      <div className={`p-4 rounded-xl ${colorClass}`}>
        <Icon size={28} />
      </div>
    </div>
  )
}
