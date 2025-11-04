import { Avatar, Badge, Button, Card, Empty, Flex, Input, List, Space, Typography } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, MessageOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listProjectMembers, listTasks, listTaskMessages, Task } from '../api/client'
import { useProjectStore } from '../store/useProjectStore'
import { useAuthStore } from '../store/useAuthStore'
import TaskChatDrawer from '../components/TaskChatDrawer'
import { useChatStore } from '../store/useChatStore'

function useTasks(projectId: number | null) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => listTasks(projectId!),
    enabled: !!projectId,
    refetchInterval: 4000
  })
}

export default function ChatsPage() {
  const { selectedProjectId } = useProjectStore()
  const { data, isLoading } = useTasks(selectedProjectId)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const role = useAuthStore(s => s.user?.role)
  const userId = useAuthStore(s => s.user?.id || null)
  const [isMember, setIsMember] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const [chatTaskId, setChatTaskId] = useState<number | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const getLastReadAt = useChatStore(s => s.getLastReadAt)
  const markTaskRead = useChatStore(s => s.markTaskRead)
  const [lastMeta, setLastMeta] = useState<Record<number, { preview: string; ts: number; unread: number }>>({})

  async function loadMembers() {
    if (!selectedProjectId) return
    const members = await listProjectMembers(selectedProjectId)
    const uid = userId
    setIsMember(!!uid && members.some((m: any) => m.user.id === uid))
  }

  useEffect(() => { loadMembers() }, [selectedProjectId])

  const canChatFor = useMemo(() => (t: Task) => {
    if (!role) return false
    if (role === 'admin') return true
    if (role === 'manager') return isMember
    if (role === 'executor') return !!userId && t.assignee_id === userId
    return false
  }, [role, isMember, userId])

  const rows = useMemo(() => (data || []).filter(canChatFor), [data, canChatFor])

  async function loadLastMessages(tasks: Task[]) {
    if (!selectedProjectId) return
    const next: Record<number, { preview: string; ts: number; unread: number }> = {}
    await Promise.all(tasks.map(async (t) => {
      try {
        const ms = await listTaskMessages(t.id)
        const last = ms[ms.length - 1]
        const preview = last ? `${last.author?.full_name ? last.author.full_name + ': ' : ''}${last.content}` : 'Нет сообщений'
        const ts = last ? new Date(last.created_at).getTime() : 0
        const lr = getLastReadAt(t.id) || 0
        const unread = ms.filter((m: any) => new Date(m.created_at).getTime() > lr && (!userId || m.author?.id !== userId)).length
        next[t.id] = { preview, ts, unread }
      } catch {}
    }))
    setLastMeta(next)
  }

  useEffect(() => {
    if (rows.length) {
      loadLastMessages(rows)
    } else {
      setLastMeta({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map(r => r.id).join(','), selectedProjectId])

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={8}>
          <Button type="text" size="large" icon={<ArrowLeftOutlined style={{ fontSize: 18 }} />} onClick={() => navigate(-1)} aria-label="Назад" />
          <Typography.Title level={3} style={{ margin: 0 }}>Чаты задач</Typography.Title>
        </Flex>
        <Flex gap={8}>
          <Input
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 220 }}
            autoComplete="off"
            name="chat-search"
            id="chat-search"
          />
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })} disabled={!selectedProjectId}>Обновить</Button>
        </Flex>
      </Flex>
      <Card>
        {selectedProjectId ? (
          <List
            loading={isLoading}
            itemLayout="horizontal"
            dataSource={rows.filter(t => {
              const q = search.trim().toLowerCase()
              if (!q) return true
              return String(t.id).includes(q) || t.name.toLowerCase().includes(q)
            })}
            renderItem={(t: Task) => {
              const meta = lastMeta[t.id]
              const unread = meta?.unread || 0
              return (
                <List.Item style={{ border: 'none', cursor: 'pointer' }} onClick={() => { setChatTaskId(t.id); setChatOpen(true); markTaskRead(t.id) }}>
                  <List.Item.Meta
                    avatar={
                      <Badge count={unread} size="small">
                        <Avatar style={{ background: 'rgba(0,185,111,0.25)', border: '1px solid rgba(0,185,111,0.45)' }} icon={<MessageOutlined />} />
                      </Badge>
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>#{t.id} · {t.name}</span>
                        {meta?.ts ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(meta.ts).toLocaleTimeString()}</Typography.Text> : null}
                      </div>
                    }
                    description={<Typography.Text style={{ opacity: 0.9 }} ellipsis>{meta?.preview || ' '}</Typography.Text>}
                  />
                </List.Item>
              )
            }}
          />
        ) : (
          <Empty description="Выберите проект на странице Проекты" />
        )}
      </Card>
      <TaskChatDrawer taskId={chatTaskId} open={chatOpen} onClose={() => setChatOpen(false)} taskTitle={rows.find(r => r.id === chatTaskId)?.name} />
    </Flex>
  )
}


