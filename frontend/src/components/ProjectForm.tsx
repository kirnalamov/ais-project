import { Form, Input, Modal } from 'antd'
import { useState } from 'react'

export default function ProjectForm({ open, onOk, onCancel }: { open: boolean; onOk: (values: any) => void; onCancel: () => void }) {
  const [form] = Form.useForm()
  const [confirmLoading, setConfirmLoading] = useState(false)

  const handleOk = async () => {
    try {
      setConfirmLoading(true)
      const values = await form.validateFields()
      await onOk(values)
      form.resetFields()
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <Modal open={open} title="Новый проект" onOk={handleOk} onCancel={onCancel} confirmLoading={confirmLoading} okText="Создать" cancelText="Отмена">
      <Form layout="vertical" form={form} initialValues={{ name: '' }}>
        <Form.Item label="Название" name="name" rules={[{ required: true, message: 'Укажите название' }]}>
          <Input placeholder="Например: Внедрение ERP" />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea placeholder="Краткое описание проекта" rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  )
}


