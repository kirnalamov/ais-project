import { Button, Card, Flex, Table, Tag, Typography, Select, message, Input } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listUsers, updateUser, type User } from '../api/client'
import { useState, useMemo } from 'react'

const ROLE_COLORS: Record<User['role'], string> = {
  admin: 'red',
  manager: 'blue',
  executor: 'green'
}

const ROLE_LABELS: Record<User['role'], string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  executor: 'Исполнитель'
}

function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })
}

export default function UsersPage() {
  const navigate = useNavigate()
  const { data: users, isLoading } = useUsers()
  const qc = useQueryClient()
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState<User['role'] | 'all'>('all')
  
  const filteredUsers = useMemo(() => {
    if (!users) return []
    
    let filtered = users
    
    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter)
    }
    
    // Search filter
    if (searchText.trim()) {
      const search = searchText.toLowerCase()
      filtered = filtered.filter(u => 
        u.email.toLowerCase().includes(search) ||
        u.full_name.toLowerCase().includes(search) ||
        u.nickname?.toLowerCase().includes(search) ||
        String(u.id).includes(search)
      )
    }
    
    return filtered
  }, [users, searchText, roleFilter])

  const handleRoleChange = async (userId: number, newRole: User['role']) => {
    setUpdatingUserId(userId)
    try {
      await updateUser(userId, { role: newRole })
      message.success('Роль успешно изменена')
      qc.invalidateQueries({ queryKey: ['users'] })
    } catch (error) {
      message.error('Ошибка при изменении роли')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'ФИО',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: 'Никнейм',
      dataIndex: 'nickname',
      key: 'nickname',
      render: (nickname: string) => nickname || '—',
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '—',
    },
    {
      title: 'Telegram',
      dataIndex: 'telegram',
      key: 'telegram',
      render: (telegram: string) => telegram || '—',
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 250,
      render: (role: User['role'], record: User) => (
        <Flex gap={8} align="center">
          <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
          <Select
            value={role}
            onChange={(newRole) => handleRoleChange(record.id, newRole)}
            loading={updatingUserId === record.id}
            disabled={updatingUserId === record.id}
            style={{ flex: 1 }}
            size="small"
            options={[
              { value: 'admin', label: ROLE_LABELS.admin },
              { value: 'manager', label: ROLE_LABELS.manager },
              { value: 'executor', label: ROLE_LABELS.executor },
            ]}
          />
        </Flex>
      ),
    },
  ]

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={8}>
          <Button type="text" size="large" icon={<ArrowLeftOutlined style={{ fontSize: 18 }} />} onClick={() => navigate(-1)} aria-label="Назад" />
          <Typography.Title level={3} style={{ margin: 0 }}>Управление пользователями</Typography.Title>
        </Flex>
        <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['users'] })}>
          Обновить
        </Button>
      </Flex>

      <Card>
        <Flex gap={12} style={{ marginBottom: 16 }}>
          <Input
            placeholder="Поиск по email, ФИО, ID..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 300 }}
          />
          <Select
            placeholder="Фильтр по роли"
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ width: 200 }}
            options={[
              { value: 'all', label: 'Все роли' },
              { value: 'admin', label: ROLE_LABELS.admin },
              { value: 'manager', label: ROLE_LABELS.manager },
              { value: 'executor', label: ROLE_LABELS.executor },
            ]}
          />
          <Typography.Text type="secondary" style={{ alignSelf: 'center' }}>
            Найдено: {filteredUsers.length}
          </Typography.Text>
        </Flex>
        
        <Table
          dataSource={filteredUsers}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </Flex>
  )
}

