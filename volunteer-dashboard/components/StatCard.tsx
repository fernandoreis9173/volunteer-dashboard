import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  // FIX: Changed type to React.ReactElement<any> to allow passing a className prop via cloneElement, resolving a TypeScript error.
  icon: React.ReactElement<any>;
  color: 'blue' | 'orange' | 'green' | 'purple' | 'teal';
  loading: boolean;
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  teal: 'bg-teal-100 text-teal-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  green: 'bg-green-100 text-green-600',
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, loading }) => {
  const classes = colorClasses[color];

  return (
    <div className="px-4 py-5 sm:p-6 flex items-center space-x-4">
      <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full ${classes}`}>
        {React.cloneElement(icon, { className: 'h-6 w-6' })}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {loading ? (
          <div className="h-9 w-16 bg-slate-200 rounded animate-pulse"></div>
        ) : (
          <p className="text-4xl font-bold text-slate-900">
            {value}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;