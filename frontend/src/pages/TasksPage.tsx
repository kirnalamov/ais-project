import { Button, Card, Empty, Flex, Space, Table, Tag, Typography, message, Input } from 'antd'
import { PlusOutlined, ReloadOutlined, EditOutlined, ArrowLeftOutlined, MessageOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createDependency, createTask, getProject, getTaskDependencies, listProjectMembers, listTasks, setTaskDependencies, Task, updateTask } from '../api/client'
import { useEffect, useState } from 'react'
import TaskForm from '../components/TaskForm'
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

export default function TasksPage({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const { selectedProjectId } = useProjectStore()
  const { data, isLoading } = useTasks(selectedProjectId)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editInitial, setEditInitial] = useState<any>(null)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [searchId, setSearchId] = useState<string>('')
  const { bumpGraphRefresh } = useProjectStore()
  const role = useAuthStore(s => s.user?.role)
  const userId = useAuthStore(s => s.user?.id || null)
  const [managerId, setManagerId] = useState<number | null>(null)
  const [assignees, setAssignees] = useState<Array<{ id: number; label: string }>>([])
  const [isMember, setIsMember] = useState<boolean>(false)
  const [chatTaskId, setChatTaskId] = useState<number | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  async function loadMembers() {
    if (!selectedProjectId) return
    const members = await listProjectMembers(selectedProjectId)
    setAssignees(members.map((m: any) => ({ id: m.user.id, label: m.user.full_name })))
    const uid = userId
    setIsMember(!!uid && members.some((m: any) => m.user.id === uid))
  }

  useEffect(() => { loadMembers() }, [selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) { setManagerId(null); return }
    getProject(selectedProjectId).then(p => setManagerId(p.manager_id ?? null)).catch(() => setManagerId(null))
  }, [selectedProjectId])

  // SSE: live refresh tasks when project updates
  useEffect(() => {
    if (!selectedProjectId) return
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
    const sse = new EventSource(`${API_BASE}/events/projects/${selectedProjectId}/stream`)
    sse.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })
      loadMembers()
      bumpGraphRefresh()
    }
    return () => sse.close()
  }, [selectedProjectId, qc, bumpGraphRefresh])

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Описание', dataIndex: 'description' },
    { title: 'Длительность', dataIndex: 'duration_plan', width: 120 },
    { title: 'Статус', dataIndex: 'status', width: 140, render: (s: string) => <Tag>{s}</Tag> },
    { title: 'Приоритет', dataIndex: 'priority', width: 120, render: (p: string) => <Tag color={p === 'high' ? 'red' : p === 'medium' ? 'gold' : 'blue'}>{p}</Tag> },
    { title: 'Действия', key: 'actions', width: 220, render: (_: any, record: Task) => {
      const canChat = (
        role === 'admin' ||
        (role === 'manager' && ( (managerId && userId === managerId) || isMember)) ||
        (role === 'executor' && userId && record.assignee_id === userId)
      )
      return (
      <Space>
        <Button icon={<EditOutlined />} onClick={async () => {
          setEditingTaskId(record.id)
          const deps = await getTaskDependencies(record.id)
          setEditInitial({ ...record, depends_on: deps.map(d => d.depends_on_task_id) })
          setEditOpen(true)
        }}>
          Редактировать
        </Button>
        {canChat && (
          <Button icon={<MessageOutlined />} onClick={() => { setChatTaskId(record.id); setChatOpen(true) }}>Чат</Button>
        )}
      </Space>
    ) }},
  ]

  const onCreate = async (values: any) => {
    if (!selectedProjectId) return
    try {
      const depends = values.depends_on as number[] | undefined
      const { depends_on, ...rest } = values
      const created = await createTask({ ...rest, project_id: selectedProjectId })
      if (depends && depends.length) {
        await Promise.all(depends.map(pid => createDependency({ task_id: created.id, depends_on_task_id: pid })))
      }
      message.success('Задача создана')
      setOpen(false)
      await qc.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })
      bumpGraphRefresh()
    } catch (e: any) {
      message.error(e?.message || 'Ошибка создания задачи')
    }
  }

  const onEdit = async (values: any) => {
    if (!selectedProjectId || !editingTaskId) return
    try {
      const { depends_on, ...rest } = values
      await updateTask(editingTaskId, rest)
      if (Array.isArray(depends_on)) {
        await setTaskDependencies(editingTaskId, depends_on)
      }
      message.success('Задача обновлена')
      setEditOpen(false)
      await qc.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })
      bumpGraphRefresh()
    } catch (e: any) {
      message.error(e?.message || 'Ошибка обновления задачи')
    }
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        {!hideTitle ? (
          <Flex align="center" gap={8}>
            <Button type="text" size="large" icon={<ArrowLeftOutlined style={{ fontSize: 18 }} />} onClick={() => navigate(-1)} aria-label="Назад" />
            <Typography.Title level={3} style={{ margin: 0 }}>Задачи</Typography.Title>
          </Flex>
        ) : <span />}
        <Flex gap={8}>
          <Input
            placeholder="Поиск по ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            allowClear
            style={{ width: 150 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })} disabled={!selectedProjectId}>Обновить</Button>
          {(role === 'admin' || role === 'manager') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} disabled={!selectedProjectId}>Новая задача</Button>
          )}
        </Flex>
      </Flex>
      <Card>
        {selectedProjectId ? (
          <Table<Task>
            rowKey="id"
            loading={isLoading}
            dataSource={(data || []).filter(t => {
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
      <TaskForm open={open} onOk={onCreate} onCancel={() => setOpen(false)} predecessors={(data || []).map(t => ({ id: t.id, name: t.name }))} assignees={assignees} />
      <TaskForm open={editOpen} onOk={onEdit} onCancel={() => setEditOpen(false)} predecessors={(data || []).filter(t => t.id !== editingTaskId).map(t => ({ id: t.id, name: t.name }))} initialValues={editInitial || undefined} title="Редактировать задачу" okText="Сохранить" assignees={assignees} />
      <TaskChatDrawer taskId={chatTaskId} open={chatOpen} onClose={() => setChatOpen(false)} />
    </Flex>
  )
}


