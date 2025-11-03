import { Card, Empty, Flex, Typography } from 'antd'
import GraphView from '../components/GraphView'
import { useProjectStore } from '../store/useProjectStore'

export default function GraphPage({ readonly = false }: { readonly?: boolean } = {}) {
  const { selectedProjectId } = useProjectStore()
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
  return (
    <Flex vertical gap={16}>
      <Typography.Title level={3} style={{ margin: 0 }}>Граф зависимостей</Typography.Title>
      <Card>
        {selectedProjectId ? (
          <GraphView projectId={selectedProjectId} apiBase={API_BASE} readonly={readonly} />
        ) : (
          <Empty description="Выберите проект на странице Проекты" />
        )}
      </Card>
    </Flex>
  )
}


