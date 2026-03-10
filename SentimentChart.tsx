import React from 'react';

interface SentimentData {
  label: string;
  value: number;
  colorClass: string; // Tailwind text color class, e.g., "text-rose-500"
}

export const SentimentChart: React.FC<{ data: SentimentData[]; title?: string }> = ({ 
  data, 
  title = "Sentiment Analysis" 
}) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  let accumulatedPercent = 0;

  // SVG Config
  const size = 200;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  if (total === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 flex flex-col h-full">
      <div className="mb-6">
        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">Distribution by AI-detected sentiment</p>
      </div>
      
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-12 flex-1">
        {/* Chart */}
        <div className="relative w-48 h-48 flex-shrink-0">
          <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 w-full h-full">
            {/* Background circle track */}
             <circle
                r={radius}
                cx={center}
                cy={center}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-gray-100 dark:text-slate-700/50"
              />
            
            {data.map((item) => {
              if (item.value === 0) return null;
              const percent = item.value / total;
              const dashArray = `${percent * circumference} ${circumference}`;
              const dashOffset = -accumulatedPercent * circumference;
              accumulatedPercent += percent;

              return (
                <circle
                  key={item.label}
                  r={radius}
                  cx={center}
                  cy={center}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  className={`${item.colorClass} transition-all duration-1000 ease-out hover:opacity-80`}
                />
              );
            })}
            
            {/* Center Text */}
            <text 
              x="50%" 
              y="45%" 
              dominantBaseline="middle" 
              textAnchor="middle" 
              className="transform rotate-90 fill-gray-900 dark:fill-white text-4xl font-bold font-display"
            >
              {total}
            </text>
            <text 
              x="50%" 
              y="65%" 
              dominantBaseline="middle" 
              textAnchor="middle" 
              className="transform rotate-90 fill-gray-400 dark:fill-slate-500 text-xs font-semibold uppercase tracking-wider"
            >
              Total
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 w-full">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
               <div className={`w-3 h-3 rounded-full shadow-sm ${item.colorClass.replace('text-', 'bg-')}`}></div>
               <div className="flex-1">
                 <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{item.label}</span>
                    <span className="text-xs font-medium text-gray-400 dark:text-slate-500">{Math.round((item.value/total)*100)}%</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${item.colorClass.replace('text-', 'bg-')}`} 
                      style={{ width: `${(item.value/total)*100}%` }}
                    ></div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};