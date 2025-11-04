import { Avatar, Badge, Button, Card, Empty, Flex, Input, List, Space, Typography } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, MessageOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listProjectMembers, listTasks, listTaskMessages, Task, sendTaskMessage } from '../api/client'
import { useProjectStore } from '../store/useProjectStore'
import { useAuthStore } from '../store/useAuthStore'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const role = useAuthStore(s => s.user?.role)
  const userId = useAuthStore(s => s.user?.id || null)
  const meId = useAuthStore(s => s.user?.id || null)
  const [isMember, setIsMember] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const [chatTaskId, setChatTaskId] = useState<number | null>(null)
  const getLastReadAt = useChatStore(s => s.getLastReadAt)
  const markTaskRead = useChatStore(s => s.markTaskRead)
  const [lastMeta, setLastMeta] = useState<Record<number, { preview: string; ts: number; unread: number }>>({})
  const [messages, setMessages] = useState<Array<any>>([])
  const [text, setText] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

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

  // Check URL params for taskId
  useEffect(() => {
    const taskIdParam = searchParams.get('taskId')
    if (taskIdParam) {
      const tid = parseInt(taskIdParam, 10)
      if (!isNaN(tid) && rows.some(t => t.id === tid)) {
        setChatTaskId(tid)
        markTaskRead(tid)
      }
    }
  }, [searchParams, rows, markTaskRead])

  // Load messages for active chat
  async function loadChatMessages() {
    if (!chatTaskId) return
    try {
      const res = await listTaskMessages(chatTaskId)
      setMessages(res)
      setTimeout(() => messagesRef.current?.scrollTo(0, 999999), 0)
    } catch (e) {
      // silent fail
    }
  }

  useEffect(() => {
    if (chatTaskId) {
      loadChatMessages()
      const interval = setInterval(() => loadChatMessages(), 3000)
      return () => clearInterval(interval)
    }
  }, [chatTaskId])

  const onSend = async () => {
    if (!chatTaskId || !text.trim()) return
    await sendTaskMessage(chatTaskId, text.trim())
    setText('')
    await loadChatMessages()
  }

  const selectChat = (taskId: number) => {
    setChatTaskId(taskId)
    markTaskRead(taskId)
    setSearchParams({ taskId: String(taskId) })
  }

  const activeTask = rows.find(t => t.id === chatTaskId)

  return (
    <Flex vertical gap={16} style={{ height: 'calc(100vh - 100px)' }}>
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

      {selectedProjectId ? (
        <div style={{ display: 'flex', gap: 16, height: '100%', overflow: 'hidden' }}>
          {/* Левая панель - список чатов */}
          <Card style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column' }} styles={{ body: { padding: 0, flex: 1, overflow: 'hidden' } }}>
            <div style={{ overflowY: 'auto', height: '100%' }}>
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
                  const isActive = chatTaskId === t.id
                  return (
                    <List.Item 
                      style={{ 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: '12px 16px',
                        background: isActive ? 'rgba(0,185,111,0.12)' : 'transparent',
                        borderLeft: isActive ? '3px solid #00b96f' : '3px solid transparent',
                        transition: 'background 0.2s ease'
                      }} 
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
                      }}
                      onClick={() => selectChat(t.id)}
                    >
                      <List.Item.Meta
                        avatar={
                          <Badge count={unread} size="small">
                            <Avatar style={{ background: 'rgba(0,185,111,0.25)', border: '1px solid rgba(0,185,111,0.45)' }} icon={<MessageOutlined />} />
                          </Badge>
                        }
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: isActive ? 600 : 400 }}>#{t.id} · {t.name}</span>
                            {meta?.ts ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(meta.ts).toLocaleTimeString()}</Typography.Text> : null}
                          </div>
                        }
                        description={<Typography.Text style={{ opacity: 0.9 }} ellipsis>{meta?.preview || ' '}</Typography.Text>}
                      />
                    </List.Item>
                  )
                }}
              />
            </div>
          </Card>

          {/* Правая панель - активный чат */}
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}>
            {chatTaskId && activeTask ? (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #2b2b2b', background: '#0f0f0f' }}>
                  <Typography.Title level={5} style={{ margin: 0, color: '#e8e8e8' }}>
                    #{activeTask.id} · {activeTask.name}
                  </Typography.Title>
                </div>
                
                <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {messages.map((m) => {
                    const mine = meId && m.author?.id === meId
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        {!mine && <Avatar style={{ marginRight: 8 }}>{(m.author?.full_name || 'U').slice(0,1).toUpperCase()}</Avatar>}
                        <div style={{ maxWidth: '70%', background: mine ? 'rgba(0,185,111,0.18)' : 'rgba(255,255,255,0.08)', border: `1px solid ${mine ? 'rgba(0,185,111,0.35)' : 'rgba(255,255,255,0.12)'}`, padding: '8px 10px', borderRadius: 12, borderTopLeftRadius: mine ? 12 : 4, borderTopRightRadius: mine ? 4 : 12 }}>
                          {!mine && (
                            <Typography.Text strong style={{ marginBottom: 4, display: 'block', color: '#e8e8e8' }}>{m.author?.full_name || 'Пользователь'}</Typography.Text>
                          )}
                          <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#e8e8e8' }}>{m.content}</Typography.Paragraph>
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>{new Date(m.created_at).toLocaleTimeString()}</Typography.Text>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                <div style={{ padding: 16, borderTop: '1px solid #2b2b2b', background: '#0f0f0f' }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder="Сообщение"
                      onPressEnter={onSend}
                      name="chat-message"
                      id="chat-message"
                    />
                    <Button type="primary" icon={<SendOutlined />} onClick={onSend}>Отправить</Button>
                  </Space.Compact>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Empty description="Выберите чат из списка" />
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <Empty description="Выберите проект на странице Проекты" />
        </Card>
      )}
    </Flex>
  )
}


