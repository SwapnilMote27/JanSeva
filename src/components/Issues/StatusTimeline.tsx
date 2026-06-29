import React from 'react';
import { CheckCircle2, Circle, Clock, Check } from 'lucide-react';
import { StatusType } from '@/src/types';

interface StatusTimelineProps {
  status: StatusType;
}

const STEPS: { status: StatusType; title: string; desc: string }[] = [
  { status: 'Reported', title: 'Issue Reported', desc: 'Submitted by citizen and auto-classified by AI.' },
  { status: 'Verified', title: 'Community Verified', desc: 'Validated by at least 3 local residents.' },
  { status: 'Assigned', title: 'Department Assigned', desc: 'Forwarded to the responsible civic agency.' },
  { status: 'In Progress', title: 'Resolution In Progress', desc: 'Maintenance crew dispatched to resolve.' },
  { status: 'Resolved', title: 'Issue Resolved', desc: 'Problem fixed! Points awarded to the reporter.' }
];

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ status }) => {
  const currentStepIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <div id="status-timeline-stepper" className="space-y-6 font-sans">
      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
        Resolution Progress Timeline
      </h3>

      <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isActive = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          let stepBadgeColor = 'bg-gray-100 text-gray-400';
          let lineConnectorColor = 'bg-gray-200';

          if (isCompleted) {
            stepBadgeColor = 'bg-emerald-100 text-emerald-600';
            lineConnectorColor = 'bg-emerald-600';
          } else if (isActive) {
            stepBadgeColor = 'bg-amber-100 text-amber-600 ring-4 ring-amber-50';
          }

          return (
            <div key={step.status} className="relative flex gap-4 text-left">
              {/* Indicator Circle */}
              <div className={`absolute -left-[23px] top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                isCompleted 
                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                  : isActive 
                  ? 'bg-white border-amber-500 text-amber-600' 
                  : 'bg-white border-gray-300 text-gray-400'
              } z-10`}>
                {isCompleted ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : isActive ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                )}
              </div>

              {/* Text content */}
              <div className="flex-1">
                <h4 className={`text-sm font-bold ${isActive ? 'text-amber-800' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                  {step.title}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {step.desc}
                </p>
                {isActive && (
                  <span className="inline-flex mt-2 items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 uppercase tracking-wide">
                    Current Status: {status}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
