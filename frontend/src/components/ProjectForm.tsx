import { Form, Input, Modal } from 'antd'
import { useEffect, useState } from 'react'

export default function ProjectForm({ open, onOk, onCancel, initialValues, title = 'Новый проект', okText = 'Создать' }: { open: boolean; onOk: (values: any) => void; onCancel: () => void; initialValues?: any; title?: string; okText?: string }) {
  const [form] = Form.useForm()
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    if (open) {
      form.setFieldsValue(initialValues || { name: '', description: '' })
    }
  }, [open, initialValues])

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
    <Modal open={open} title={title} onOk={handleOk} onCancel={onCancel} confirmLoading={confirmLoading} okText={okText} cancelText="Отмена">
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


