interface StageProgressProps {
  currentStage: number;
  totalStages: number;
  title: string;
}

export function StageProgress({ currentStage, totalStages, title }: StageProgressProps) {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 shadow-xl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-xl">Stage {currentStage + 1} of {totalStages}</h2>
          <span className="text-amber-100 text-sm">{title}</span>
        </div>
        <div className="w-full bg-amber-800 rounded-full h-4 overflow-hidden">
          <div
            className="bg-white h-4 transition-all duration-500 rounded-full"
            style={{ width: `${((currentStage + 1) / totalStages) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
