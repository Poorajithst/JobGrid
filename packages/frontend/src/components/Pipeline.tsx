interface PipelineProps {
  status: string;
  onStatusChange: (status: string) => void;
}

const STAGES = ['discovered', 'applied', 'interview', 'offer'];

export function Pipeline({ status, onStatusChange }: PipelineProps) {
  const isRejected = status === 'rejected';
  const activeIndex = STAGES.indexOf(status);

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Pipeline</div>
      <div className="flex gap-[3px]">
        {STAGES.map((stage, i) => (
          <button
            key={stage}
            onClick={() => onStatusChange(stage)}
            className={`flex-1 py-2.5 text-center text-xs font-semibold transition-all cursor-pointer
              ${i === 0 ? 'rounded-l-[10px]' : ''} ${i === STAGES.length - 1 ? 'rounded-r-[10px]' : ''}
              ${!isRejected && i <= activeIndex
                ? 'bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)]'
                : 'bg-bg-card/50 text-text-dim border border-border-subtle hover:text-text-muted hover:bg-bg-card/80'
              }`}
          >
            {stage.charAt(0).toUpperCase() + stage.slice(1)}
          </button>
        ))}
      </div>
      <button
        onClick={() => onStatusChange('rejected')}
        className={`mt-2 w-full py-2 rounded-lg text-xs font-semibold transition-all
          ${isRejected
            ? 'bg-accent-red/20 text-accent-red-light border border-accent-red/30'
            : 'bg-bg-card/30 text-text-dim border border-border-subtle hover:text-accent-red-light hover:border-accent-red/30'
          }`}
      >
        {isRejected ? 'Rejected' : 'Mark as Rejected'}
      </button>
    </div>
  );
}
