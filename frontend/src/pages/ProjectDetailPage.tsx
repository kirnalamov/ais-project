import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Flex, Typography, Segmented, theme } from 'antd'
import TasksPage from './TasksPage'
import GraphPage from './GraphPage'
import { useProjectStore } from '../store/useProjectStore'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { setSelectedProjectId } = useProjectStore()
  const [view, setView] = useState<'graph' | 'tasks'>('graph')
  const { token } = theme.useToken()

  useEffect(() => {
    if (!isNaN(projectId)) setSelectedProjectId(projectId)
  }, [projectId, setSelectedProjectId])

  return (
    <Flex vertical gap={16}>
      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <Typography.Title level={2} style={{ margin: 0, color: token.colorText }}>Проект #{projectId}</Typography.Title>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <Segmented
            size="large"
            options={[{ label: 'Граф', value: 'graph' }, { label: 'Задачи', value: 'tasks' }]}
            value={view}
            onChange={(v) => setView(v as any)}
          />
        </div>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
        <div style={{ display: 'flex', width: '200%', transition: 'transform 400ms ease', transform: view === 'graph' ? 'translateX(0%)' : 'translateX(-50%)' }}>
          {/* Panel 1: Graph full */}
          <div style={{ width: '50%', paddingRight: 8 }}>
            <GraphPage hideTitle showDuration={false} />
          </div>
          {/* Panel 2: Tasks with graph preview */}
          <div style={{ width: '50%', paddingLeft: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
              <div>
                <TasksPage hideTitle />
              </div>
              <div>
                <GraphPage readonly hideTitle showDuration={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Flex>
  )
}


