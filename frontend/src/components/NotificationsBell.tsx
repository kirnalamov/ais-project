import { Badge, Button, Drawer, List, Space, Typography } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import React from 'react'
import { useNotificationStore } from '../store/useNotificationStore'
import { useProjectStore } from '../store/useProjectStore'
import { useAuthStore } from '../store/useAuthStore'
import { listTasks, getTaskDependencies, Task, listProjects, Project } from '../api/client'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function NotificationsBell() {
  const [open, setOpen] = React.useState(false)
  const notifications = useNotificationStore((s) => s.notifications)
  const add = useNotificationStore((s) => s.add)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const { selectedProjectId } = useProjectStore()
  const userId = useAuthStore((s) => s.user?.id || null)
  const role = useAuthStore((s) => s.user?.role || null)
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length

  const unblockedNotifiedRef = React.useRef<Set<number>>(new Set())
  const sseMapRef = React.useRef<Map<number, EventSource>>(new Map())
  const [adminProjectIds, setAdminProjectIds] = React.useState<number[]>([])

  // Load all projects for admin to subscribe to all
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (role !== 'admin') { setAdminProjectIds([]); return }
      try {
        const projects: Project[] = await listProjects()
        if (!cancelled) setAdminProjectIds(projects.map(p => p.id))
      } catch {
        if (!cancelled) setAdminProjectIds([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [role])

  // Manage SSE subscriptions: admin -> all projects; others -> selected project only
  React.useEffect(() => {
    const wantProjectIds = role === 'admin' ? adminProjectIds : (selectedProjectId ? [selectedProjectId] : [])
    const current = sseMapRef.current

    // Close streams that are no longer needed
    for (const [pid, ev] of Array.from(current.entries())) {
      if (!wantProjectIds.includes(pid)) {
        try { ev.close() } catch {}
        current.delete(pid)
      }
    }

    // Helper to attach a stream for a project
    const attach = (pid: number) => {
      if (current.has(pid)) return
      const es = new EventSource(`${API_BASE}/events/projects/${pid}/stream`)
      es.onmessage = async (e) => {
        const kind = String(e.data || '')
        if (kind === 'message') {
          add({ type: 'message', text: `Новое сообщение в проекте #${pid}`, link: '/chats' })
        } else if (kind === 'task_created') {
          add({ type: 'task', text: `Создана новая задача в проекте #${pid}`, link: '/projects' })
        } else if (kind === 'task_updated') {
          add({ type: 'task', text: `Обновлён статус задачи в проекте #${pid}`, link: '/projects' })
          // Detect unblocked tasks for current user within this project
          try {
            if (!userId) return
            const tasks = await listTasks(pid)
            const byId: Record<number, Task> = Object.fromEntries(tasks.map((t) => [t.id, t]))
            const myTodo = tasks.filter((t) => t.assignee_id === userId && t.status === 'backlog')
            for (const t of myTodo) {
              const deps = await getTaskDependencies(t.id)
              const allDone = deps.every((d) => byId[d.depends_on_task_id]?.status === 'done')
              if (allDone && !unblockedNotifiedRef.current.has(t.id)) {
                unblockedNotifiedRef.current.add(t.id)
                add({ type: 'deps', text: `Можно начинать задачу #${t.id} (проект #${pid})`, link: '/tasks' })
              }
            }
          } catch {}
        } else if (kind === 'deps_updated') {
          add({ type: 'deps', text: `Обновлены зависимости задач (проект #${pid})`, link: '/projects' })
        } else {
          add({ type: 'info', text: `Обновления в проекте #${pid}`, link: '/projects' })
        }
      }
      es.onerror = () => {
        // noop; best-effort
      }
      current.set(pid, es)
    }

    // Open streams we want
    wantProjectIds.forEach(attach)

    return () => {
      // On unmount, close everything
      for (const [, ev] of Array.from(current.entries())) {
        try { ev.close() } catch {}
      }
      current.clear()
    }
  }, [role, adminProjectIds, selectedProjectId, add, userId])

  const onOpen = () => {
    setOpen(true)
    markAllRead()
  }

  return (
    <>
      <Badge count={unread} overflowCount={99} size="small">
        <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} onClick={onOpen} aria-label="Уведомления" />
      </Badge>
      <Drawer open={open} onClose={() => setOpen(false)} title="Уведомления" width={420}>
        <List
          dataSource={notifications}
          renderItem={(n) => (
            <List.Item style={{ border: 'none' }} onClick={() => { if (n.link) navigate(n.link); setOpen(false) }}>
              <Space direction="vertical" size={2}>
                <Typography.Text>{n.text}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(n.ts).toLocaleString()}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Drawer>
    </>
  )
}


