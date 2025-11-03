import { create } from 'zustand'

type ProjectState = {
  selectedProjectId: number | null
  setSelectedProjectId: (id: number | null) => void
  graphRefreshTick: number
  bumpGraphRefresh: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  selectedProjectId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  graphRefreshTick: 0,
  bumpGraphRefresh: () => set((s) => ({ graphRefreshTick: s.graphRefreshTick + 1 }))
}))


