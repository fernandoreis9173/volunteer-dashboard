import React from 'react';

interface VolunteerStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement<any>;
  color: 'blue' | 'green' | 'yellow' | 'purple';
  loading?: boolean;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-100',
    icon: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-100',
    icon: 'text-green-600',
  },
  yellow: {
    bg: 'bg-yellow-100',
    icon: 'text-yellow-600',
  },
  purple: {
      bg: 'bg-purple-100',
      icon: 'text-purple-600',
  }
};

const VolunteerStatCard: React.FC<VolunteerStatCardProps> = ({ title, value, icon, color, loading }) => {
  if (loading) {
    return (
      <div className="px-4 py-5 sm:p-6 flex items-center space-x-4 animate-pulse">
        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-200"></div>
        <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-8 bg-slate-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }
  
  const classes = colorClasses[color];

  return (
    <div className="px-4 py-5 sm:p-6 flex items-center space-x-4">
      <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-lg leading-none ${classes.bg} ${classes.icon}`}>
        {React.cloneElement(icon, { className: 'h-6 w-6 block flex-shrink-0', style: { overflow: 'visible' } })}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-4xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
};

export default VolunteerStatCard;