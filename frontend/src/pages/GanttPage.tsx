import { Card, Empty, Flex, Typography } from 'antd'
import { useProjectStore } from '../store/useProjectStore'
import GanttView from '../components/GanttView'

export default function GanttPage({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const { selectedProjectId } = useProjectStore()
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
  return (
    <Flex vertical gap={16}>
      {!hideTitle && <Typography.Title level={3} style={{ margin: 0 }}>Диаграмма Ганта</Typography.Title>}
      <Card styles={{ body: { padding: 12 } }}>
        {selectedProjectId ? (
          <GanttView projectId={selectedProjectId} apiBase={API_BASE} />
        ) : (
          <Empty description="Выберите проект на странице Проекты" />
        )}
      </Card>
    </Flex>
  )
}


