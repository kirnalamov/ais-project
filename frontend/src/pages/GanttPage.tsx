import { Button, Card, Empty, Flex, Typography } from 'antd'
import { useProjectStore } from '../store/useProjectStore'
import GanttView from '../components/GanttView'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

export default function GanttPage({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const { selectedProjectId } = useProjectStore()
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
  const navigate = useNavigate()
  return (
    <Flex vertical gap={16}>
      {!hideTitle && (
        <Flex align="center" gap={8}>
          <Button type="text" size="large" icon={<ArrowLeftOutlined style={{ fontSize: 18 }} />} onClick={() => navigate(-1)} aria-label="Назад" />
          <Typography.Title level={3} style={{ margin: 0 }}>Диаграмма Ганта</Typography.Title>
        </Flex>
      )}
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


