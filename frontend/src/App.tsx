import React from 'react'
import { Layout, Menu, theme, Typography, Button } from 'antd'
import { ProjectOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import TasksPage from './pages/TasksPage'
import GraphPage from './pages/GraphPage'
import ProjectDetailPage from './pages/ProjectDetailPage'

const { Header, Sider, Content } = Layout

export default function App() {
  const location = useLocation()
  const { token } = theme.useToken()
  const [collapsed, setCollapsed] = React.useState(false)
  const selectedKey = 'projects'
  const menuItems = [
    { key: 'projects', icon: <ProjectOutlined />, label: <Link to="/projects">Проекты</Link> }
  ]
  return (
    <Layout style={{ minHeight: '100vh', position: 'relative' }} className="app-grid-bg">
      <Sider collapsible collapsed={collapsed} trigger={false} breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 48, margin: 16, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Planner</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ background: token.colorBgElevated, borderBottom: `1px solid ${token.colorBorder}`, paddingInline: 12, display: 'flex', alignItems: 'center', gap: 12, height: 52, lineHeight: '52px' }}>
          <Button type="text" style={{ color: token.colorText }} icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
          <Typography.Title level={4} style={{ margin: 0, color: token.colorText }}>Корпоративный планировщик задач</Typography.Title>
        </Header>
        <Content style={{ margin: 16 }}>
          <Routes>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}



