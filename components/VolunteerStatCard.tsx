import React from 'react';

interface VolunteerStatCardProps {
  title: string;
  value: string | number;
  // FIX: Changed type to React.ReactElement<any> to allow passing className via cloneElement.
  icon: React.ReactElement<any>;
  color: 'blue' | 'green' | 'yellow' | 'purple';
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

const VolunteerStatCard: React.FC<VolunteerStatCardProps> = ({ title, value, icon, color }) => {
  const classes = colorClasses[color];

  return (
    <div className="w-64 sm:w-auto flex-shrink-0 bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
      <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-lg ${classes.bg} ${classes.icon}`}>
        {React.cloneElement(icon, { className: 'h-6 w-6' })}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{title}</p>
      </div>
    </div>
  );
};

export default VolunteerStatCard;