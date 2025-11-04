import { Button, Card, Empty, Flex, Input, Space, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, MessageOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listProjectMembers, listTasks, Task } from '../api/client'
import { useProjectStore } from '../store/useProjectStore'
import { useAuthStore } from '../store/useAuthStore'
import TaskChatDrawer from '../components/TaskChatDrawer'

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
  const [searchId, setSearchId] = useState<string>('')
  const [chatTaskId, setChatTaskId] = useState<number | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

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

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Статус', dataIndex: 'status', width: 140, render: (s: string) => <Tag>{s}</Tag> },
    { title: 'Действия', key: 'actions', width: 160, render: (_: any, record: Task) => (
      <Space>
        <Button icon={<MessageOutlined />} type="primary" onClick={() => { setChatTaskId(record.id); setChatOpen(true) }}>Открыть чат</Button>
      </Space>
    ) },
  ]

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={8}>
          <Button type="text" size="large" icon={<ArrowLeftOutlined style={{ fontSize: 18 }} />} onClick={() => navigate(-1)} aria-label="Назад" />
          <Typography.Title level={3} style={{ margin: 0 }}>Чаты задач</Typography.Title>
        </Flex>
        <Flex gap={8}>
          <Input
            placeholder="Поиск по ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            allowClear
            style={{ width: 150 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })} disabled={!selectedProjectId}>Обновить</Button>
        </Flex>
      </Flex>
      <Card>
        {selectedProjectId ? (
          <Table<Task>
            rowKey="id"
            loading={isLoading}
            dataSource={rows.filter(t => {
              const q = searchId.trim()
              if (!q) return true
              return String(t.id).includes(q)
            })}
            columns={columns}
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <Empty description="Выберите проект на странице Проекты" />
        )}
      </Card>
      <TaskChatDrawer taskId={chatTaskId} open={chatOpen} onClose={() => setChatOpen(false)} />
    </Flex>
  )
}


