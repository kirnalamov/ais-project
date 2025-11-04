import { Button, Card, Form, Input, Typography, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import { useState } from 'react'

export default function LoginPage() {
  const setAuth = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: any) => {
    try {
      setLoading(true)
      const res = await login(values)
      setAuth(res.access_token, res.user)
      navigate('/projects', { replace: true })
    } catch (e: any) {
      message.error(e?.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>Вход</Typography.Title>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ email: 'admin@example.com', password: 'admin' }}>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item label="Пароль" name="password" rules={[{ required: true }]}>
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>Войти</Button>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            <div>Демо пользователи:</div>
            <div>admin@example.com / admin</div>
            <div>manager@example.com / manager</div>
            <div>executor@example.com / executor</div>
          </div>
        </Form>
      </Card>
    </div>
  )
}


