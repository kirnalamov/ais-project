import { Drawer, List, Input, Button, Space, Typography, Avatar } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { listTaskMessages, sendTaskMessage } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import { useChatStore } from '../store/useChatStore'

export default function TaskChatDrawer({ taskId, open, onClose, taskTitle }: { taskId: number | null; open: boolean; onClose: () => void; taskTitle?: string }) {
  const [messages, setMessages] = useState<Array<any>>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const meId = useAuthStore(s => s.user?.id || null)
  const markTaskRead = useChatStore(s => s.markTaskRead)

  async function load() {
    if (!taskId) return
    setLoading(true)
    try {
      const res = await listTaskMessages(taskId)
      setMessages(res)
      // scroll to bottom
      setTimeout(() => listRef.current?.scrollTo(0, 999999), 0)
    } catch (e) {
      // do not throw to UI
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      load()
      const t = setInterval(() => load(), 3000)
      return () => clearInterval(t)
    }
  }, [open, taskId])

  useEffect(() => {
    if (open && taskId) {
      // mark as read when opened or when messages update
      markTaskRead(taskId, Date.now())
    }
  }, [open, taskId, messages, markTaskRead])

  const onSend = async () => {
    if (!taskId || !text.trim()) return
    await sendTaskMessage(taskId, text.trim())
    setText('')
    await load()
  }

  return (
    <Drawer open={open} onClose={onClose} title={taskTitle ? `Чат: ${taskTitle}` : `Чат по задаче #${taskId}`} width={520}>
      <div ref={listRef} style={{ height: '60vh', overflowY: 'auto', padding: 8, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <Typography.Text type="secondary">Загрузка...</Typography.Text>}
        {messages.map((m) => {
          const mine = meId && m.author?.id === meId
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              {!mine && <Avatar style={{ marginRight: 8 }}>{(m.author?.full_name || 'U').slice(0,1).toUpperCase()}</Avatar>}
              <div style={{ maxWidth: '70%', background: mine ? 'rgba(0,185,111,0.18)' : 'rgba(255,255,255,0.08)', border: `1px solid ${mine ? 'rgba(0,185,111,0.35)' : 'rgba(255,255,255,0.12)'}`, padding: '8px 10px', borderRadius: 12, borderTopLeftRadius: mine ? 12 : 4, borderTopRightRadius: mine ? 4 : 12 }}>
                {!mine && (
                  <Typography.Text strong style={{ marginBottom: 4, display: 'block' }}>{m.author?.full_name || 'Пользователь'}</Typography.Text>
                )}
                <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>{new Date(m.created_at).toLocaleTimeString()}</Typography.Text>
              </div>
            </div>
          )
        })}
      </div>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Сообщение"
          onPressEnter={onSend}
          name="task-chat-message"
          id="task-chat-message"
        />
        <Button type="primary" onClick={onSend}>Отправить</Button>
      </Space.Compact>
    </Drawer>
  )
}


