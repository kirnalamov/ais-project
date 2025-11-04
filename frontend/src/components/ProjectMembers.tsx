import { Button, List, Modal, Space, Typography, AutoComplete, message, Tag, Popconfirm, Input } from 'antd'
import { useEffect, useState } from 'react'
import { addProjectMember, deleteProjectMember, listProjectMembers, searchUsers } from '../api/client'

export default function ProjectMembers({ projectId, open, onClose, canManage, inline = false }: { projectId: number; open?: boolean; onClose?: () => void; canManage: boolean; inline?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Array<{ id: number; project_id: number; user: any }>>([])
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Array<{ value: string; label: string; userId: number }>>([])
  const [adding, setAdding] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const m = await listProjectMembers(projectId)
      setMembers(m)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!projectId || Number.isNaN(projectId)) return
    if (inline || open) load()
  }, [inline, open, projectId])

  const onSearch = async (val: string) => {
    setQuery(val)
    if (!val.trim()) { setOptions([]); return }
    const res = await searchUsers(val.trim())
    setOptions(res.map(u => ({ value: `${u.full_name} <${u.email}>`, label: `${u.full_name} <${u.email}>`, userId: u.id })))
  }

  const onSelect = async (_: string, opt: any) => {
    if (!canManage) return
    try {
      setAdding(true)
      await addProjectMember(projectId, opt.userId)
      message.success('Пользователь добавлен в проект')
      setQuery('')
      setOptions([])
      await load()
    } catch (e: any) {
      message.error(e?.message || 'Ошибка добавления')
    } finally {
      setAdding(false)
    }
  }

  const content = (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {canManage && (
        <AutoComplete
          value={query}
          options={options}
          onSearch={onSearch}
          onSelect={onSelect}
        >
          <Input
            placeholder="Добавить участника по имени или email"
            style={{ width: '100%' }}
            disabled={adding}
            name="project-member-search"
            id={`project-${projectId}-member-search`}
          />
        </AutoComplete>
      )}
      <List
        loading={loading}
        dataSource={members}
        renderItem={(m) => (
          <List.Item
            actions={canManage ? [
              <Popconfirm key="rm" title="Убрать из проекта?" onConfirm={async () => {
                await deleteProjectMember(projectId, m.user.id)
                await load()
              }}>
                <Button danger size="small">Убрать</Button>
              </Popconfirm>
            ] : undefined}
          >
            <Space>
              <Typography.Text>{m.user.full_name}</Typography.Text>
              <Typography.Text type="secondary">{m.user.email}</Typography.Text>
              {m.user.nickname && <Tag>@{m.user.nickname}</Tag>}
              <Tag color="blue">{m.user.role}</Tag>
            </Space>
          </List.Item>
        )}
      />
    </Space>
  )

  if (inline) return content
  return (
    <Modal open={!!open} onCancel={onClose} onOk={onClose} okText="Готово" cancelButtonProps={{ style: { display: 'none' } }} title={`Участники проекта #${projectId}`}>
      {content}
    </Modal>
  )
}


