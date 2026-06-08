import { ElementType } from 'react';

interface Props {
  label: string;
  value: number | string;
  Icon: ElementType;
  color: 'green' | 'orange' | 'red' | 'blue' | 'gray' | 'indigo';
  sub?: string;
}

const COLORS = {
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-700',  val: 'text-green-700'  },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-700', val: 'text-orange-700' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-700',       val: 'text-red-700'    },
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-700',     val: 'text-blue-700'   },
  gray:   { bg: 'bg-gray-50',   icon: 'bg-gray-100 text-gray-600',     val: 'text-gray-700'   },
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-100 text-indigo-700', val: 'text-indigo-700' },
};

export default function StatsCard({ label, value, Icon, color, sub }: Props) {
  const c = COLORS[color];
  return (
    <div className={`${c.bg} rounded-xl p-5 flex items-center gap-4 shadow-sm border border-white`}>
      <div className={`${c.icon} p-3 rounded-lg`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className={`text-3xl font-bold ${c.val}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
