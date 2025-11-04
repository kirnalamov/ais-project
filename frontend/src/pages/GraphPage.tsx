import { Button, Card, Empty, Flex, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import GraphView from '../components/GraphView'
import { useProjectStore } from '../store/useProjectStore'

export default function GraphPage({ readonly = false, hideTitle = false, showDuration = true }: { readonly?: boolean; hideTitle?: boolean; showDuration?: boolean } = {}) {
  const { selectedProjectId } = useProjectStore()
  const { id: paramProjectId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
  const navigate = useNavigate()
  
  // Use projectId from URL param if available, otherwise from store
  const projectId = paramProjectId ? parseInt(paramProjectId, 10) : selectedProjectId
  const highlightTaskId = searchParams.get('highlight') ? parseInt(searchParams.get('highlight')!, 10) : undefined
  
  return (
    <Flex vertical gap={16}>
      {!hideTitle && (
        <Flex align="center" gap={8}>
          <Button type="text" size="large" icon={<ArrowLeftOutlined style={{ fontSize: 18 }} />} onClick={() => navigate(-1)} aria-label="Назад" />
          <Typography.Title level={3} style={{ margin: 0 }}>Граф зависимостей</Typography.Title>
        </Flex>
      )}
      <Card styles={{ body: { padding: 0 } }}>
        {projectId ? (
          <GraphView 
            projectId={projectId} 
            apiBase={API_BASE} 
            readonly={readonly} 
            showDuration={showDuration}
            highlightTaskId={highlightTaskId}
          />
        ) : (
          <Empty description="Выберите проект на странице Проекты" />
        )}
      </Card>
    </Flex>
  )
}


