import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'

export default function TaskForm({ open, onOk, onCancel, predecessors, initialValues, title = 'Новая задача', okText = 'Создать', assignees }: { open: boolean; onOk: (values: any) => void; onCancel: () => void; predecessors?: Array<{ id: number; name: string }>; initialValues?: any; title?: string; okText?: string; assignees?: Array<{ id: number; label: string }> }) {
  const [form] = Form.useForm()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const normalizedInitialValues = useMemo(() => {
    if (!initialValues) return undefined
    const { deadline, ...rest } = initialValues
    return {
      ...rest,
      deadline: deadline ? dayjs(deadline) : undefined
    }
  }, [initialValues])

  const handleOk = async () => {
    try {
      setConfirmLoading(true)
      const values = await form.validateFields()
      await onOk({
        ...values,
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : undefined
      })
      form.resetFields()
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <Modal open={open} title={title} onOk={handleOk} onCancel={onCancel} confirmLoading={confirmLoading} okText={okText} cancelText="Отмена">
      <Form layout="vertical" form={form} initialValues={{ status: 'backlog', priority: 'medium', duration_plan: 1, ...(normalizedInitialValues || {}) }}>
        <Form.Item label="Название" name="name" rules={[{ required: true, message: 'Укажите название' }]}>
          <Input placeholder="Например: Подготовка ТЗ" />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea placeholder="Краткое описание задачи" rows={3} />
        </Form.Item>
        <Form.Item label="Плановая длительность (дней)" name="duration_plan" rules={[{ required: true, type: 'number', min: 0 }]}>
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Статус" name="status">
          <Select options={[{ value: 'backlog', label: 'Backlog' }, { value: 'in_progress', label: 'In Progress' }, { value: 'review', label: 'Review' }, { value: 'done', label: 'Done' }]} />
        </Form.Item>
        <Form.Item label="Приоритет" name="priority">
          <Select options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
        </Form.Item>
        {assignees && (
          <Form.Item label="Исполнитель" name="assignee_id">
            <Select allowClear placeholder="Выберите исполнителя" options={assignees.map(a => ({ value: a.id, label: a.label }))} />
          </Form.Item>
        )}
        <Form.Item label="Дедлайн" name="deadline">
          <DatePicker style={{ width: '100%' }} format={'YYYY-MM-DD'} />
        </Form.Item>
        {predecessors && predecessors.length > 0 && (
          <Form.Item label="Зависит от задач" name="depends_on">
            <Select
              mode="multiple"
              placeholder="Выберите задачи-предшественники"
              options={predecessors.map(t => ({ value: t.id, label: `${t.name} (#${t.id})` }))}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}


