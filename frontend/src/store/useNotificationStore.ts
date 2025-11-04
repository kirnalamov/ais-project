import { create } from 'zustand'

export type AppNotification = {
  id: string
  type: 'message' | 'task' | 'deps' | 'info'
  text: string
  ts: number
  read: boolean
  link?: string
  meta?: any
}

type NotificationState = {
  notifications: AppNotification[]
  add: (n: Omit<AppNotification, 'id' | 'read' | 'ts'> & { id?: string; ts?: number; read?: boolean }) => void
  markAllRead: () => void
  clear: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  add: (n) => set((s) => {
    const id = n.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const ts = n.ts ?? Date.now()
    const read = n.read ?? false
    const next: AppNotification = { id, ts, read, type: n.type, text: n.text, link: n.link, meta: n.meta }
    return { notifications: [next, ...s.notifications].slice(0, 200) }
  }),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((x) => ({ ...x, read: true })) })),
  clear: () => set({ notifications: [] })
}))


