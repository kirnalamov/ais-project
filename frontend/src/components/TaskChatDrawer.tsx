import { Drawer, List, Input, Button, Space, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { listTaskMessages, sendTaskMessage } from '../api/client'

export default function TaskChatDrawer({ taskId, open, onClose }: { taskId: number | null; open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Array<any>>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  async function load() {
    if (!taskId) return
    setLoading(true)
    try {
      const res = await listTaskMessages(taskId)
      setMessages(res)
      // scroll to bottom
      setTimeout(() => listRef.current?.scrollTo(0, 999999), 0)
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

  const onSend = async () => {
    if (!taskId || !text.trim()) return
    await sendTaskMessage(taskId, text.trim())
    setText('')
    await load()
  }

  return (
    <Drawer open={open} onClose={onClose} title={`Чат по задаче #${taskId}`} width={420}>
      <div ref={listRef} style={{ height: '60vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, marginBottom: 12 }}>
        <List
          loading={loading}
          dataSource={messages}
          renderItem={(m) => (
            <List.Item style={{ border: 'none' }}>
              <Space direction="vertical" size={2}>
                <Typography.Text strong>{m.author?.full_name || 'Пользователь'}</Typography.Text>
                <Typography.Paragraph style={{ margin: 0 }}>{m.content}</Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(m.created_at).toLocaleString()}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </div>
      <Space.Compact style={{ width: '100%' }}>
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="Сообщение" onPressEnter={onSend} />
        <Button type="primary" onClick={onSend}>Отправить</Button>
      </Space.Compact>
    </Drawer>
  )
}


