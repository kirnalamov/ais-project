import { Button, Card, Empty, Flex, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import GraphView from '../components/GraphView'
import { useProjectStore } from '../store/useProjectStore'

export default function GraphPage({ readonly = false, hideTitle = false, showDuration = true }: { readonly?: boolean; hideTitle?: boolean; showDuration?: boolean } = {}) {
  const { selectedProjectId } = useProjectStore()
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
  const navigate = useNavigate()
  return (
    <Flex vertical gap={16}>
      {!hideTitle && (
        <Flex align="center" gap={8}>
          <Button type="text" size="large" icon={<ArrowLeftOutlined style={{ fontSize: 18 }} />} onClick={() => navigate(-1)} aria-label="Назад" />
          <Typography.Title level={3} style={{ margin: 0 }}>Граф зависимостей</Typography.Title>
        </Flex>
      )}
      <Card styles={{ body: { padding: 0 } }}>
        {selectedProjectId ? (
          <GraphView projectId={selectedProjectId} apiBase={API_BASE} readonly={readonly} showDuration={showDuration} />
        ) : (
          <Empty description="Выберите проект на странице Проекты" />
        )}
      </Card>
    </Flex>
  )
}


