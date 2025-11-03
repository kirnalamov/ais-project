import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Col, Flex, Row, Typography } from 'antd'
import TasksPage from './TasksPage'
import GraphPage from './GraphPage'
import { useProjectStore } from '../store/useProjectStore'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const { setSelectedProjectId } = useProjectStore()

  useEffect(() => {
    if (!isNaN(projectId)) setSelectedProjectId(projectId)
  }, [projectId, setSelectedProjectId])

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={3} style={{ margin: 0 }}>Проект #{projectId}</Typography.Title>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <TasksPage />
        </Col>
        <Col xs={24} lg={12}>
          <GraphPage />
        </Col>
      </Row>
    </Flex>
  )
}


