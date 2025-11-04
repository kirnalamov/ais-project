import React from 'react'
import { Layout, Menu, theme, Typography, Button, Tag, Space, Badge, Dropdown } from 'antd'
import { ProjectOutlined, MessageOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import TasksPage from './pages/TasksPage'
import GraphPage from './pages/GraphPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import UsersPage from './pages/UsersPage'
import ProfilePage from './pages/ProfilePage'
import { useAuthStore } from './store/useAuthStore'
import ChatsPage from './pages/ChatsPage'
import NotificationsBell from './components/NotificationsBell'

const { Header, Sider, Content } = Layout

export default function App() {
  const location = useLocation()
  const { token } = theme.useToken()
  const [collapsed, setCollapsed] = React.useState(false)
  const auth = useAuthStore()
  const selectedKey = React.useMemo(() => {
    const p = location.pathname
    if (p.startsWith('/chats')) return 'chats'
    if (p.startsWith('/projects')) return 'projects'
    if (p.startsWith('/tasks')) return 'tasks'
    if (p.startsWith('/graph')) return 'graph'
    if (p.startsWith('/users')) return 'users'
    if (p.startsWith('/profile')) return 'profile'
    return 'projects'
  }, [location.pathname])
  
  const menuItems = React.useMemo(() => {
    const items = [
      { key: 'projects', icon: <ProjectOutlined />, label: <Link to="/projects">Проекты</Link> },
      { key: 'chats', icon: <MessageOutlined />, label: <Link to="/chats">Чаты</Link> }
    ]
    
    // Add Users menu item for admin only
    if (auth.user?.role === 'admin') {
      items.push({ key: 'users', icon: <UserOutlined />, label: <Link to="/users">Пользователи</Link> })
    }
    
    return items
  }, [auth.user?.role])

  return (
    <Layout style={{ minHeight: '100vh', position: 'relative' }} className="app-grid-bg">
      <Sider collapsible collapsed={collapsed} trigger={false} breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 48, margin: 16, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Planner</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ background: token.colorBgElevated, borderBottom: `1px solid ${token.colorBorder}`, paddingInline: 12, display: 'flex', alignItems: 'center', gap: 12, height: 52, lineHeight: '52px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button type="text" style={{ color: token.colorText }} icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
            <Typography.Title level={4} style={{ margin: 0, color: token.colorText }}>Корпоративный планировщик задач</Typography.Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {auth.user && (
              <NotificationsBell />
            )}
            {auth.user ? (
              <Space>
                <Tag color="green">{auth.user.role}</Tag>
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'profile',
                        icon: <UserOutlined />,
                        label: <Link to="/profile">Мой профиль</Link>,
                      },
                      {
                        type: 'divider',
                      },
                      {
                        key: 'logout',
                        icon: <LogoutOutlined />,
                        label: 'Выйти',
                        onClick: () => auth.clearAuth(),
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button type="text" icon={<UserOutlined />}>
                    {auth.user.full_name}
                  </Button>
                </Dropdown>
              </Space>
            ) : (
              <Button><Link to="/login">Войти</Link></Button>
            )}
          </div>
        </Header>
        <Content style={{ margin: 16 }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/projects" element={auth.token ? <ProjectsPage /> : <Navigate to="/login" replace />} />
            <Route path="/projects/:id" element={auth.token ? <ProjectDetailPage /> : <Navigate to="/login" replace />} />
            <Route path="/projects/:id/graph" element={auth.token ? <GraphPage /> : <Navigate to="/login" replace />} />
            <Route path="/tasks" element={auth.token ? <TasksPage /> : <Navigate to="/login" replace />} />
            <Route path="/graph" element={auth.token ? <GraphPage /> : <Navigate to="/login" replace />} />
            <Route path="/chats" element={auth.token ? <ChatsPage /> : <Navigate to="/login" replace />} />
            <Route path="/users" element={auth.token && auth.user?.role === 'admin' ? <UsersPage /> : <Navigate to="/login" replace />} />
            <Route path="/profile" element={auth.token ? <ProfilePage /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to={auth.token ? '/projects' : '/login'} replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}



