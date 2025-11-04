import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flex, Typography, Segmented, theme, Button, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import TasksPage from './TasksPage'
import GraphPage from './GraphPage'
import GanttPage from './GanttPage'
import { useProjectStore } from '../store/useProjectStore'
import ProjectMembers from '../components/ProjectMembers'
import ProjectForm from '../components/ProjectForm'
import { useAuthStore } from '../store/useAuthStore'
import { useQuery } from '@tanstack/react-query'
import { getProject, updateProject } from '../api/client'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { setSelectedProjectId } = useProjectStore()
  const [view, setView] = useState<'graph' | 'tasks' | 'gantt'>('graph')
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const auth = useAuthStore()
  const [membersOpen, setMembersOpen] = useState(false)
  const { data: project, isError } = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId), enabled: !isNaN(projectId) })
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
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Button
            type="text"
            size="large"
            icon={<ArrowLeftOutlined style={{ fontSize: 20 }} />}
            onClick={() => navigate(-1)}
            aria-label="Назад"
            style={{ justifySelf: 'start' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Segmented
              size="large"
              options={[{ label: 'Граф', value: 'graph' }, { label: 'Задачи', value: 'tasks' }, { label: 'Гант', value: 'gantt' }]}
              value={view}
              onChange={(v) => setView(v as any)}
            />
          </div>
          <div style={{ justifySelf: 'end' }}>
            <Flex gap={8}>
              {canManage && (
                <>
                  <Button onClick={() => setMembersOpen(true)}>Участники</Button>
                  <EditProjectButton projectId={projectId} initialValues={{ name: project?.name, description: project?.description }} onUpdated={() => message.success('Проект обновлён')} />
                </>
              )}
            </Flex>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
        <div style={{ display: 'flex', width: '300%', transition: 'transform 400ms ease', transform: view === 'graph' ? 'translateX(0%)' : view === 'tasks' ? 'translateX(-33.3333%)' : 'translateX(-66.6666%)' }}>
          {/* Panel 1: Graph full */}
          <div style={{ width: '33.3333%', paddingRight: 8 }}>
            <GraphPage hideTitle showDuration={false} />
          </div>
          {/* Panel 2: Tasks with graph preview */}
          <div style={{ width: '33.3333%', paddingLeft: 8, paddingRight: 8 }}>
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
          <div style={{ width: '33.3333%', paddingLeft: 8 }}>
            <GanttPage hideTitle />
          </div>
        </div>
      </div>
      <ProjectMembers projectId={projectId} open={membersOpen} onClose={() => setMembersOpen(false)} canManage={canManage} />
    </Flex>
  )
}

function EditProjectButton({ projectId, initialValues, onUpdated }: { projectId: number; initialValues: any; onUpdated?: () => void }) {
  const [open, setOpen] = useState(false)
  const { refetch } = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId), enabled: false })
  const onOk = async (values: any) => {
    await updateProject(projectId, values)
    await refetch()
    onUpdated?.()
    setOpen(false)
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>Редактировать</Button>
      <ProjectForm open={open} onOk={onOk} onCancel={() => setOpen(false)} initialValues={initialValues} title="Редактировать проект" okText="Сохранить" />
    </>
  )
}


