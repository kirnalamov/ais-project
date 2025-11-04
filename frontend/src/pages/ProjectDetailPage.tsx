import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flex, Typography, Segmented, theme, Button, message, Form, Input, Card } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import TasksPage from './TasksPage'
import GraphPage from './GraphPage'
import GanttPage from './GanttPage'
import { useProjectStore } from '../store/useProjectStore'
import ProjectMembers from '../components/ProjectMembers'
import { useAuthStore } from '../store/useAuthStore'
import { useQuery } from '@tanstack/react-query'
import { getProject, updateProject } from '../api/client'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { setSelectedProjectId } = useProjectStore()
  const [view, setView] = useState<'graph' | 'tasks' | 'gantt' | 'members' | 'settings'>('graph')
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const auth = useAuthStore()
  const { data: project, isError, refetch } = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId), enabled: !isNaN(projectId), refetchInterval: 5000 })
  const canManage = useMemo(() => {
    if (!auth.user) return false
    if (auth.user.role === 'admin') return true
    if (auth.user.role === 'manager' && project && project.manager_id === auth.user.id) return true
    return false
  }, [auth.user, project])

  useEffect(() => {
    if (!isNaN(projectId)) setSelectedProjectId(projectId)
  }, [projectId, setSelectedProjectId])

  return (
    <Flex vertical gap={16}>
      <div style={{ padding: '8px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography.Title level={2} style={{ margin: 0, color: token.colorText }}>Проект #{projectId}: {project?.name || ''}</Typography.Title>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Button
            type="text"
            size="large"
            icon={<ArrowLeftOutlined style={{ fontSize: 20 }} />}
            onClick={() => navigate(-1)}
            aria-label="Назад"
            style={{ justifySelf: 'start' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <Segmented
              size="large"
              options={[
                { label: 'Граф', value: 'graph' },
                { label: 'Задачи', value: 'tasks' },
                { label: 'Гант', value: 'gantt' },
                { label: 'Участники', value: 'members' },
                ...(canManage ? [{ label: 'Настройки', value: 'settings' } as const] : [])
              ]}
              value={view}
              onChange={(v) => setView(v as any)}
            />
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
        {(() => {
          const total = 4 + (canManage ? 1 : 0)
          const panelWidth = 100 / total
          const order = (canManage ? ['graph','tasks','gantt','members','settings'] : ['graph','tasks','gantt','members']) as Array<typeof view>
          const index = Math.max(0, order.indexOf(view))
          return (
            <div style={{ display: 'flex', width: `${total * 100}%`, transition: 'transform 400ms ease', transform: `translateX(-${index * panelWidth}%)` }}>
              {/* Panel 1: Graph full */}
              <div style={{ width: `${panelWidth}%`, paddingRight: 8 }}>
                <GraphPage hideTitle showDuration={false} />
              </div>
              {/* Panel 2: Tasks with graph preview */}
              <div style={{ width: `${panelWidth}%`, paddingLeft: 8, paddingRight: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
                  <div>
                    <TasksPage hideTitle />
                  </div>
                  <div style={{ marginTop: 44 }}>
                    <GraphPage readonly hideTitle showDuration={false} />
                  </div>
                </div>
              </div>
              {/* Panel 3: Gantt full */}
              <div style={{ width: `${panelWidth}%`, paddingLeft: 8 }}>
                <GanttPage hideTitle />
              </div>
              {/* Panel 4: Members inline */}
              <div style={{ width: `${panelWidth}%`, paddingLeft: 8 }}>
                <Card title={`Участники проекта #${projectId}`}>
                  <ProjectMembers projectId={projectId} canManage={canManage} inline />
                </Card>
              </div>
              {/* Panel 5: Settings (managers only) */}
              {canManage && (
                <div style={{ width: `${panelWidth}%`, paddingLeft: 8 }}>
                  <Card title="Настройки проекта">
                    <ProjectSettingsInline projectId={projectId} initialValues={{ name: project?.name, description: project?.description }} onUpdated={async () => { await refetch(); message.success('Проект обновлён') }} />
                  </Card>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </Flex>
  )
}

function ProjectSettingsInline({ projectId, initialValues, onUpdated }: { projectId: number; initialValues: any; onUpdated?: () => void }) {
  const [form] = Form.useForm()
  useEffect(() => {
    form.setFieldsValue(initialValues || { name: '', description: '' })
  }, [initialValues?.name, initialValues?.description])
  const onFinish = async (values: any) => {
    await updateProject(projectId, values)
    onUpdated?.()
  }
  return (
    <Form layout="vertical" form={form} onFinish={onFinish}>
      <Form.Item label="Название" name="name" rules={[{ required: true, message: 'Укажите название' }]}>
        <Input placeholder="Например: Внедрение ERP" />
      </Form.Item>
      <Form.Item label="Описание" name="description">
        <Input.TextArea placeholder="Краткое описание проекта" rows={4} />
      </Form.Item>
      <Button type="primary" htmlType="submit">Сохранить</Button>
    </Form>
  )
}


