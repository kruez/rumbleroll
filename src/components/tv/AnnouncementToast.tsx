"use client";

import { toast } from "sonner";

interface EntryAnnouncementProps {
  wrestlerName: string;
  entryNumber: number;
}

interface EliminationAnnouncementProps {
  wrestlerName: string;
  eliminatedBy: string;
  entryNumber: number;
}

export function showEntryAnnouncement({
  wrestlerName,
  entryNumber,
}: EntryAnnouncementProps) {
  toast.custom(
    () => (
      <div className="w-full animate-[slideInFromTop_0.5s_ease-out]">
        <div className="bg-gradient-to-r from-green-600 via-green-500 to-green-600 text-white px-6 py-4 rounded-lg shadow-2xl border-2 border-green-400">
          <div className="flex items-center justify-center gap-4">
            <span className="text-3xl font-black tracking-tight shrink-0">#{entryNumber}</span>
            <div className="h-8 w-0.5 bg-green-300 shrink-0" />
            <span className="text-2xl font-bold uppercase tracking-wider truncate">
              {wrestlerName}
            </span>
          </div>
          <p className="text-center text-green-100 text-sm mt-1 font-medium tracking-widest">
            HAS ENTERED THE RING!
          </p>
        </div>
      </div>
    ),
    {
      duration: 3000,
      position: "top-left",
      className: "!w-full !max-w-2xl",
    }
  );
}

export function showEliminationAnnouncement({
  wrestlerName,
  eliminatedBy,
  entryNumber,
}: EliminationAnnouncementProps) {
  toast.custom(
    () => (
      <div className="w-full animate-[shake_0.5s_ease-in-out]">
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white px-6 py-4 rounded-lg shadow-2xl border-2 border-red-400">
          <div className="flex items-center justify-center gap-4">
            <span className="text-3xl font-black text-red-200 shrink-0">#{entryNumber}</span>
            <div className="h-8 w-0.5 bg-red-400 shrink-0" />
            <span className="text-2xl font-bold uppercase tracking-wider line-through decoration-2">
              {wrestlerName}
            </span>
          </div>
          <p className="text-center text-red-100 text-sm mt-1 font-medium tracking-widest">
            ELIMINATED BY <span className="font-black">{eliminatedBy.toUpperCase()}</span>
          </p>
        </div>
      </div>
    ),
    {
      duration: 4000,
      position: "top-right",
      className: "!w-full !max-w-4xl",
    }
  );
}

export function showWinnerAnnouncement(wrestlerName: string, entryNumber: number) {
  toast.custom(
    () => (
      <div className="w-full animate-[fadeIn_0.5s_ease-out]">
        <div className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 text-black px-6 py-4 rounded-lg shadow-2xl border-2 border-yellow-300">
          <div className="flex items-center justify-center gap-4">
            <span className="text-4xl">&#128081;</span>
            <div className="text-center">
              <p className="text-xl font-black uppercase tracking-widest text-yellow-900">
                ROYAL RUMBLE WINNER
              </p>
              <p className="text-3xl font-black uppercase tracking-tight">
                {wrestlerName}
              </p>
            </div>
            <span className="text-4xl">&#128081;</span>
          </div>
        </div>
      </div>
    ),
    {
      duration: 10000,
      position: "top-center",
      className: "!w-full !max-w-2xl",
    }
  );
}
