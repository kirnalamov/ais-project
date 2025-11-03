import { Button, Card, Flex, Table, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createProject, listProjects, Project } from '../api/client'
import { useState } from 'react'
import ProjectForm from '../components/ProjectForm'
import { useProjectStore } from '../store/useProjectStore'
import { useNavigate } from 'react-router-dom'

export default function ProjectsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const [open, setOpen] = useState(false)
  const { selectedProjectId, setSelectedProjectId } = useProjectStore()
  const navigate = useNavigate()

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Описание', dataIndex: 'description' }
  ]

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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Новый проект</Button>
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


