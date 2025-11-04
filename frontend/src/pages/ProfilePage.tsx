import { Button, Card, Flex, Typography, Tag, Table, Statistic, Row, Col, Progress, List, Avatar } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, UserOutlined, ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyStats, type UserStats, type Task } from '../api/client'

const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  manager: 'blue',
  executor: 'green'
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  executor: 'Исполнитель'
}

const STATUS_COLORS: Record<Task['status'], string> = {
  backlog: 'default',
  in_progress: 'processing',
  review: 'warning',
  done: 'success'
}

const STATUS_LABELS: Record<Task['status'], string> = {
  backlog: 'Бэклог',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Выполнено'
}

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: 'blue',
  medium: 'orange',
  high: 'red'
}

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий'
}

function useMyStats() {
  return useQuery({
    queryKey: ['myStats'],
    queryFn: getMyStats,
  })
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useMyStats()
  const qc = useQueryClient()

  const tasksColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Задача',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: UserStats['tasks'][0]) => (
        <div>
          <div>{name}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.project_name}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: Task['status']) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      width: 120,
      render: (priority: Task['priority']) => (
        <Tag color={PRIORITY_COLORS[priority]}>{PRIORITY_LABELS[priority]}</Tag>
      ),
    },
    {
      title: 'Длительность',
      dataIndex: 'duration_plan',
      key: 'duration_plan',
      width: 120,
      render: (duration: number) => `${duration} дн.`,
    },
  ]

  const projectsColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '—',
    },
    {
      title: 'Задач',
      dataIndex: 'tasks_count',
      key: 'tasks_count',
      width: 100,
    },
    {
      title: 'Дедлайн',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 120,
      render: (deadline: string) => deadline ? new Date(deadline).toLocaleDateString() : '—',
    },
  ]

  const completionRate = stats ? 
    stats.stats.total_tasks > 0 
      ? Math.round((stats.stats.tasks_by_status.done / stats.stats.total_tasks) * 100) 
      : 0 
    : 0

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={8}>
          <Button type="text" size="large" icon={<ArrowLeftOutlined style={{ fontSize: 18 }} />} onClick={() => navigate(-1)} aria-label="Назад" />
          <Typography.Title level={3} style={{ margin: 0 }}>Мой профиль</Typography.Title>
        </Flex>
        <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['myStats'] })} loading={isLoading}>
          Обновить
        </Button>
      </Flex>

      {/* Информация о пользователе */}
      <Card loading={isLoading}>
        <Flex gap={16} align="center">
          <Avatar size={80} icon={<UserOutlined />} style={{ background: '#1890ff' }} />
          <div style={{ flex: 1 }}>
            <Typography.Title level={4} style={{ margin: 0, marginBottom: 8 }}>
              {stats?.user.full_name}
            </Typography.Title>
            <Flex gap={8} align="center" style={{ marginBottom: 4 }}>
              <Typography.Text type="secondary">Email:</Typography.Text>
              <Typography.Text>{stats?.user.email}</Typography.Text>
            </Flex>
            {stats?.user.nickname && (
              <Flex gap={8} align="center" style={{ marginBottom: 4 }}>
                <Typography.Text type="secondary">Никнейм:</Typography.Text>
                <Typography.Text>{stats.user.nickname}</Typography.Text>
              </Flex>
            )}
            {stats?.user.phone && (
              <Flex gap={8} align="center" style={{ marginBottom: 4 }}>
                <Typography.Text type="secondary">Телефон:</Typography.Text>
                <Typography.Text>{stats.user.phone}</Typography.Text>
              </Flex>
            )}
            {stats?.user.telegram && (
              <Flex gap={8} align="center" style={{ marginBottom: 4 }}>
                <Typography.Text type="secondary">Telegram:</Typography.Text>
                <Typography.Text>{stats.user.telegram}</Typography.Text>
              </Flex>
            )}
            <div style={{ marginTop: 8 }}>
              <Tag color={ROLE_COLORS[stats?.user.role || 'executor']}>
                {ROLE_LABELS[stats?.user.role || 'executor']}
              </Tag>
            </div>
          </div>
        </Flex>
      </Card>

      {/* Статистика */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего задач"
              value={stats?.stats.total_tasks || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Выполнено"
              value={stats?.stats.tasks_by_status.done || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="В работе"
              value={stats?.stats.tasks_by_status.in_progress || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Проектов"
              value={stats?.stats.total_projects || 0}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Прогресс выполнения */}
      <Card title="Прогресс выполнения задач">
        <Flex vertical gap={16}>
          <div>
            <Flex justify="space-between" style={{ marginBottom: 8 }}>
              <Typography.Text>Процент выполнения</Typography.Text>
              <Typography.Text strong>{completionRate}%</Typography.Text>
            </Flex>
            <Progress 
              percent={completionRate} 
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>

          <Row gutter={16}>
            <Col span={6}>
              <Card size="small" style={{ background: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.3)' }}>
                <Statistic
                  title="Бэклог"
                  value={stats?.stats.tasks_by_status.backlog || 0}
                  valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ background: 'rgba(250,173,20,0.1)', border: '1px solid rgba(250,173,20,0.3)' }}>
                <Statistic
                  title="В работе"
                  value={stats?.stats.tasks_by_status.in_progress || 0}
                  valueStyle={{ color: '#faad14', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ background: 'rgba(250,173,20,0.1)', border: '1px solid rgba(250,173,20,0.3)' }}>
                <Statistic
                  title="На проверке"
                  value={stats?.stats.tasks_by_status.review || 0}
                  valueStyle={{ color: '#faad14', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ background: 'rgba(82,196,26,0.1)', border: '1px solid rgba(82,196,26,0.3)' }}>
                <Statistic
                  title="Завершено"
                  value={stats?.stats.tasks_by_status.done || 0}
                  valueStyle={{ color: '#52c41a', fontSize: 20 }}
                />
              </Card>
            </Col>
          </Row>
        </Flex>
      </Card>

      {/* Мои задачи */}
      <Card title="Мои задачи">
        <Table
          dataSource={stats?.tasks || []}
          columns={tasksColumns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Мои проекты */}
      <Card title="Мои проекты">
        <Table
          dataSource={stats?.projects || []}
          columns={projectsColumns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Flex>
  )
}

