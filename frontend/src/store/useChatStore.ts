import { create } from 'zustand'

type ChatState = {
  lastReadAtByTaskId: Record<number, number>
  markTaskRead: (taskId: number, ts?: number) => void
  getLastReadAt: (taskId: number) => number | undefined
  reset: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  lastReadAtByTaskId: {},
  markTaskRead: (taskId, ts) => set((s) => ({
    lastReadAtByTaskId: { ...s.lastReadAtByTaskId, [taskId]: ts ?? Date.now() }
  })),
  getLastReadAt: (taskId) => get().lastReadAtByTaskId[taskId],
  reset: () => set({ lastReadAtByTaskId: {} })
}))


