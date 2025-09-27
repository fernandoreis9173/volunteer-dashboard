import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  // FIX: Changed JSX.Element to React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
  icon: React.ReactElement;
  color: 'blue' | 'orange' | 'green' | 'purple';
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-100',
    iconBg: 'bg-blue-200',
    iconText: 'text-blue-600',
  },
  orange: {
    bg: 'bg-orange-100',
    iconBg: 'bg-orange-200',
    iconText: 'text-orange-600',
  },
  green: {
    bg: 'bg-green-100',
    iconBg: 'bg-green-200',
    iconText: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-100',
    iconBg: 'bg-purple-200',
    iconText: 'text-purple-600',
  },
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const classes = colorClasses[color];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm flex justify-between items-center overflow-hidden">
      <div className="z-10">
        <p className="text-slate-500">{title}</p>
        <p className="text-4xl font-bold text-slate-800 mt-1">{value}</p>
      </div>
      <div className={`relative -mr-10 -my-10 w-24 h-24 rounded-full ${classes.bg} flex items-center justify-center`}>
         <div className={`w-16 h-16 rounded-full ${classes.iconBg} ${classes.iconText} flex items-center justify-center`}>
           {icon}
         </div>
      </div>
    </div>
  );
};

export default StatCard;