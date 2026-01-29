"use client";

interface PlayerColor {
  bg: string;
  border: string;
  text: string;
  ring: string;
}

interface UpNextBadgeProps {
  mode: "pending" | "entered" | "hidden";
  entryNumber: number;
  participantName: string;
  wrestlerName?: string;
  playerColor: PlayerColor;
}

export function UpNextBadge({
  mode,
  entryNumber,
  participantName,
  wrestlerName,
  playerColor,
}: UpNextBadgeProps) {
  if (mode === "hidden") {
    return null;
  }

  if (mode === "entered" && wrestlerName) {
    return (
      <div className="fixed top-4 left-4 z-40 animate-[upNextPulse_1s_ease-in-out_3]">
        <div
          className={`${playerColor.bg} border-2 ${playerColor.border} rounded-lg px-4 py-3 shadow-2xl`}
        >
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-black ${playerColor.text}`}>
              #{entryNumber}
            </span>
            <div className={`h-8 w-0.5 ${playerColor.bg} opacity-50`} />
            <div>
              <p className="text-white font-bold text-lg uppercase tracking-wide">
                {wrestlerName}
              </p>
              <p className={`${playerColor.text} text-xs font-medium`}>
                {participantName}
              </p>
            </div>
          </div>
          <p className="text-green-400 text-xs font-bold tracking-widest mt-1 text-center">
            ENTERED!
          </p>
        </div>
      </div>
    );
  }

  // mode === "pending"
  return (
    <div className="fixed top-4 left-4 z-40">
      <div
        className={`${playerColor.bg} border-2 ${playerColor.border} rounded-lg px-4 py-3 shadow-2xl`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-black ${playerColor.text}`}>
            #{entryNumber}
          </span>
          <div className={`h-8 w-0.5 ${playerColor.bg} opacity-50`} />
          <div>
            <p className="text-white font-bold text-lg">{participantName}</p>
            <p className={`${playerColor.text} text-xs font-bold tracking-widest`}>
              UP NEXT
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
