import { Button, Card, Empty, Flex, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createDependency, createTask, getTaskDependencies, listTasks, setTaskDependencies, Task, updateTask } from '../api/client'
import { useState } from 'react'
import TaskForm from '../components/TaskForm'
import { useProjectStore } from '../store/useProjectStore'

function useTasks(projectId: number | null) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => listTasks(projectId!),
    enabled: !!projectId
  })
}

export default function TasksPage({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const { selectedProjectId } = useProjectStore()
  const { data, isLoading } = useTasks(selectedProjectId)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editInitial, setEditInitial] = useState<any>(null)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const { bumpGraphRefresh } = useProjectStore()

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Описание', dataIndex: 'description' },
    { title: 'Длительность', dataIndex: 'duration_plan', width: 120 },
    { title: 'Статус', dataIndex: 'status', width: 140, render: (s: string) => <Tag>{s}</Tag> },
    { title: 'Приоритет', dataIndex: 'priority', width: 120, render: (p: string) => <Tag color={p === 'high' ? 'red' : p === 'medium' ? 'gold' : 'blue'}>{p}</Tag> },
    { title: 'Действия', key: 'actions', width: 120, render: (_: any, record: Task) => (
      <Space>
        <Button icon={<EditOutlined />} onClick={async () => {
          setEditingTaskId(record.id)
          const deps = await getTaskDependencies(record.id)
          setEditInitial({ ...record, depends_on: deps.map(d => d.depends_on_task_id) })
          setEditOpen(true)
        }}>
          Редактировать
        </Button>
      </Space>
    ) }
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
        {!hideTitle && <Typography.Title level={3} style={{ margin: 0 }}>Задачи</Typography.Title>}
        <Flex gap={8}>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })} disabled={!selectedProjectId}>Обновить</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} disabled={!selectedProjectId}>Новая задача</Button>
        </Flex>
      </Flex>
      <Card>
        {selectedProjectId ? (
          <Table<Task>
            rowKey="id"
            loading={isLoading}
            dataSource={data || []}
            columns={columns}
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <Empty description="Выберите проект на странице Проекты" />
        )}
      </Card>
      <TaskForm open={open} onOk={onCreate} onCancel={() => setOpen(false)} predecessors={(data || []).map(t => ({ id: t.id, name: t.name }))} />
      <TaskForm open={editOpen} onOk={onEdit} onCancel={() => setEditOpen(false)} predecessors={(data || []).filter(t => t.id !== editingTaskId).map(t => ({ id: t.id, name: t.name }))} initialValues={editInitial || undefined} title="Редактировать задачу" okText="Сохранить" />
    </Flex>
  )
}


