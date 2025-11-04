import { Avatar, Badge, Button, Card, Empty, Flex, Input, List, Space, Typography, Select } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, MessageOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listTasks, listTaskMessages, Task, sendTaskMessage, listProjects, type Project } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import { useChatStore } from '../store/useChatStore'

function useAllTasks() {
  return useQuery({
    queryKey: ['allTasks'],
    queryFn: () => listTasks(),
    // No polling - we use SSE for real-time updates
  })
}

function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
}

export default function ChatsPage() {
  const { data, isLoading } = useAllTasks()
  const { data: projects } = useProjects()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const role = useAuthStore(s => s.user?.role)
  const userId = useAuthStore(s => s.user?.id || null)
  const meId = useAuthStore(s => s.user?.id || null)
  const [search, setSearch] = useState<string>('')
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<number | 'all'>('all')
  const [chatTaskId, setChatTaskId] = useState<number | null>(null)
  const getLastReadAt = useChatStore(s => s.getLastReadAt)
  const markTaskRead = useChatStore(s => s.markTaskRead)
  const [lastMeta, setLastMeta] = useState<Record<number, { preview: string; ts: number; unread: number }>>({})
  const [messages, setMessages] = useState<Array<any>>([])
  const [text, setText] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  const canChatFor = useMemo(() => (t: Task) => {
    if (!role) return false
    if (role === 'admin') return true
    if (role === 'manager') return true
    if (role === 'executor') return !!userId && t.assignee_id === userId
    return false
  }, [role, userId])

  const rows = useMemo(() => {
    let filtered = (data || []).filter(canChatFor)
    
    // Filter by project if selected
    if (selectedProjectFilter !== 'all') {
      filtered = filtered.filter(t => t.project_id === selectedProjectFilter)
    }
    
    // Sort by last message timestamp (newest first)
    filtered.sort((a, b) => {
      const tsA = lastMeta[a.id]?.ts || 0
      const tsB = lastMeta[b.id]?.ts || 0
      return tsB - tsA // Descending order (newest first)
    })
    
    return filtered
  }, [data, canChatFor, selectedProjectFilter, lastMeta])
  
  // Create project map for displaying project names
  const projectMap = useMemo(() => {
    const map: Record<number, Project> = {}
    if (projects) {
      projects.forEach(p => map[p.id] = p)
    }
    return map
  }, [projects])

  async function loadLastMessages(tasks: Task[]) {
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
  }, [rows.map(r => r.id).join(',')])

  // Subscribe to SSE events for real-time updates
  useEffect(() => {
    if (!projects || projects.length === 0) return
    
    const eventSources: EventSource[] = []
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
    
    // Subscribe to all user's projects
    projects.forEach(project => {
      const es = new EventSource(`${API_BASE}/events/projects/${project.id}/stream`)
      
      es.onmessage = async (e) => {
        try {
          const eventData = JSON.parse(e.data)
          
          // Handle message events
          if (eventData.kind === 'message' && eventData.task_id) {
            // Update metadata for this specific chat
            const task = rows.find(t => t.id === eventData.task_id)
            if (task) {
              await loadLastMessages([task])
            }
            
            // If this is the active chat, reload messages
            if (chatTaskId === eventData.task_id) {
              await loadChatMessages()
            }
          }
          
          // Handle task updates (new tasks, status changes, etc)
          if (eventData.kind === 'task_created' || eventData.kind === 'task_updated') {
            // Refresh the tasks list
            qc.invalidateQueries({ queryKey: ['allTasks'] })
          }
        } catch (err) {
          // Ignore parse errors for non-JSON events
        }
      }
      
      es.onerror = () => {
        // Silent fail, will retry automatically
      }
      
      eventSources.push(es)
    })
    
    return () => {
      eventSources.forEach(es => es.close())
    }
  }, [projects, rows, chatTaskId, qc])

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
    }
  }, [chatTaskId])

  const onSend = async () => {
    if (!chatTaskId || !text.trim()) return
    await sendTaskMessage(chatTaskId, text.trim())
    setText('')
    await loadChatMessages()
    // Immediately update last messages metadata
    await loadLastMessages([rows.find(t => t.id === chatTaskId)].filter(Boolean) as Task[])
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
          <Select
            placeholder="Все проекты"
            value={selectedProjectFilter}
            onChange={setSelectedProjectFilter}
            style={{ width: 200 }}
            options={[
              { value: 'all', label: 'Все проекты' },
              ...(projects || []).map(p => ({ value: p.id, label: p.name }))
            ]}
          />
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
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['allTasks'] })}>Обновить</Button>
        </Flex>
      </Flex>

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
                            <div>
                              <div style={{ fontWeight: isActive ? 600 : 400 }}>#{t.id} · {t.name}</div>
                              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                {projectMap[t.project_id]?.name || `Проект #${t.project_id}`}
                              </Typography.Text>
                            </div>
                            {meta?.ts ? (
                              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                {(() => {
                                  const msgDate = new Date(meta.ts)
                                  const now = new Date()
                                  const diffDays = Math.floor((now.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24))
                                  
                                  if (diffDays === 0) {
                                    return msgDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                                  } else if (diffDays === 1) {
                                    return 'Вчера'
                                  } else if (diffDays < 7) {
                                    return msgDate.toLocaleDateString('ru-RU', { weekday: 'short' })
                                  } else {
                                    return msgDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
                                  }
                                })()}
                              </Typography.Text>
                            ) : null}
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
    </Flex>
  )
}


