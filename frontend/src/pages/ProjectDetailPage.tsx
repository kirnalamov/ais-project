import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Flex, Typography, Segmented } from 'antd'
import TasksPage from './TasksPage'
import GraphPage from './GraphPage'
import { useProjectStore } from '../store/useProjectStore'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { setSelectedProjectId } = useProjectStore()
  const [view, setView] = useState<'graph' | 'tasks'>('graph')

  useEffect(() => {
    if (!isNaN(projectId)) setSelectedProjectId(projectId)
  }, [projectId, setSelectedProjectId])

  return (
    <Flex vertical gap={12}>
      <Flex align="center" justify="space-between">
        <Typography.Title level={3} style={{ margin: 0 }}>Проект #{projectId}</Typography.Title>
        <Segmented
          options={[{ label: 'Граф', value: 'graph' }, { label: 'Задачи', value: 'tasks' }]}
          value={view}
          onChange={(v) => setView(v as any)}
        />
      </Flex>

      <div style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
        <div style={{ display: 'flex', width: '200%', transition: 'transform 400ms ease', transform: view === 'graph' ? 'translateX(0%)' : 'translateX(-50%)' }}>
          {/* Panel 1: Graph full */}
          <div style={{ width: '50%', paddingRight: 8 }}>
            <GraphPage />
          </div>
          {/* Panel 2: Tasks with graph preview */}
          <div style={{ width: '50%', paddingLeft: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
              <div>
                <TasksPage />
              </div>
              <div>
                <GraphPage readonly />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Flex>
  )
}


