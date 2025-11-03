import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flex, Typography, Segmented, theme, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import TasksPage from './TasksPage'
import GraphPage from './GraphPage'
import GanttPage from './GanttPage'
import { useProjectStore } from '../store/useProjectStore'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { setSelectedProjectId } = useProjectStore()
  const [view, setView] = useState<'graph' | 'tasks' | 'gantt'>('graph')
  const { token } = theme.useToken()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNaN(projectId)) setSelectedProjectId(projectId)
  }, [projectId, setSelectedProjectId])

  return (
    <Flex vertical gap={16}>
      <div style={{ padding: '8px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography.Title level={2} style={{ margin: 0, color: token.colorText }}>Проект #{projectId}</Typography.Title>
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
          <span />
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
    </Flex>
  )
}


