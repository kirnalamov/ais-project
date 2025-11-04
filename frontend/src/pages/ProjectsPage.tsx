import { Button, Card, Flex, Popconfirm, Table, Typography, message } from 'antd'
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import { createProject, deleteProject, listProjects, Project } from '../api/client'
import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import ProjectForm from '../components/ProjectForm'
import { useProjectStore } from '../store/useProjectStore'
import { useNavigate } from 'react-router-dom'

export default function ProjectsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['projects'], queryFn: listProjects, refetchInterval: 5000 })
  const [open, setOpen] = useState(false)
  const { selectedProjectId, setSelectedProjectId } = useProjectStore()
  const navigate = useNavigate()
  const role = useAuthStore(s => s.user?.role)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (projectId: number) => {
    try {
      setDeletingId(projectId)
      await deleteProject(projectId)
      message.success('Проект удалён')
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null)
      }
      await qc.invalidateQueries({ queryKey: ['projects'] })
    } catch (e: any) {
      message.error(e?.message || 'Не удалось удалить проект')
    } finally {
      setDeletingId(null)
    }
  }

  const columns: ColumnsType<Project> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Описание', dataIndex: 'description' }
  ]

  if (role === 'admin') {
    columns.push({
      title: 'Действия',
      dataIndex: 'actions',
      width: 140,
      render: (_, record) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            title="Удалить проект?"
            description="Все задачи и данные проекта будут удалены."
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} loading={deletingId === record.id} disabled={deletingId !== null && deletingId !== record.id}>
              Удалить
            </Button>
          </Popconfirm>
        </div>
      )
    })
  }

  const onCreate = async (values: any) => {
    try {
      const p = await createProject(values)
      message.success(`Проект создан (#${p.id})`)
      setOpen(false)
      await qc.invalidateQueries({ queryKey: ['projects'] })
      setSelectedProjectId(p.id)
    } catch (e: any) {
      message.error(e?.message || 'Ошибка создания проекта')
    }
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        <Typography.Title level={3} style={{ margin: 0 }}>Проекты</Typography.Title>
        <Flex gap={8}>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['projects'] })}>Обновить</Button>
          {(role === 'admin' || role === 'manager') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Новый проект</Button>
          )}
        </Flex>
      </Flex>
      <Card>
        <Table<Project>
          rowKey="id"
          loading={isLoading}
          dataSource={data || []}
          columns={columns}
          pagination={{ pageSize: 10 }}
          onRow={(record) => ({ onClick: () => { setSelectedProjectId(record.id); navigate(`/projects/${record.id}`) } })}
          rowClassName={(record) => record.id === selectedProjectId ? 'ant-table-row-selected' : ''}
        />
      </Card>
      <ProjectForm open={open} onOk={onCreate} onCancel={() => setOpen(false)} />
    </Flex>
  )
}


