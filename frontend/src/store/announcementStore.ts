import { create } from "zustand";
import { persist } from "zustand/middleware";

export const ANNOUNCEMENT_STORAGE_KEY = "denthub-announcement";

export interface AnnouncementState {
  dismissed: boolean;
  dismiss: () => void;
  dismissAnnouncement: () => void;
  reset: () => void;
}

export const useAnnouncementStore = create<AnnouncementState>()(
  persist(
    (set) => ({
      dismissed: false,
      dismiss: () => set({ dismissed: true }),
      dismissAnnouncement: () => set({ dismissed: true }),
      reset: () => set({ dismissed: false }),
    }),
    {
      name: ANNOUNCEMENT_STORAGE_KEY,
      partialize: (state) => ({ dismissed: state.dismissed }),
    },
  ),
);
