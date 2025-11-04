import { Button, Card, Form, Input, Typography, message } from 'antd'
import { useNavigate, Link } from 'react-router-dom'
import { login, register } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import { useState } from 'react'

export default function RegisterPage() {
  const setAuth = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: any) => {
    try {
      setLoading(true)
      await register(values)
      const res = await login({ email: values.email, password: values.password })
      setAuth(res.access_token, res.user)
      navigate('/projects', { replace: true })
    } catch (e: any) {
      message.error(e?.message || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
      <Card style={{ width: 420 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>Регистрация</Typography.Title>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="email@example.com" autoComplete="email" />
          </Form.Item>
          <Form.Item label="Пароль" name="password" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="••••••••" autoComplete="new-password" />
          </Form.Item>
          <Form.Item label="ФИО" name="full_name" rules={[{ required: true }]}>
            <Input placeholder="Иванов Иван Иванович" autoComplete="name" />
          </Form.Item>
          <Form.Item label="Ник" name="nickname">
            <Input placeholder="@ivan" autoComplete="nickname" />
          </Form.Item>
          <Form.Item label="Контактный номер" name="phone">
            <Input placeholder="+7 999 123-45-67" autoComplete="tel" inputMode="tel" />
          </Form.Item>
          <Form.Item label="Telegram" name="telegram">
            <Input placeholder="@telegram" autoComplete="off" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>Зарегистрироваться</Button>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}


