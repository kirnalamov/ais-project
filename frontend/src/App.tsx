import { Layout, Menu, theme, Typography } from 'antd'
import { ProjectOutlined, ApartmentOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import TasksPage from './pages/TasksPage'
import GraphPage from './pages/GraphPage'
import ProjectDetailPage from './pages/ProjectDetailPage'

const { Header, Sider, Content } = Layout

export default function App() {
  const location = useLocation()
  const selectedKey = location.pathname.startsWith('/tasks') ? 'tasks' : location.pathname.startsWith('/graph') ? 'graph' : 'projects'
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 48, margin: 16, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Planner</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]}>
          <Menu.Item key="projects" icon={<ProjectOutlined />}>
            <Link to="/projects">Проекты</Link>
          </Menu.Item>
          <Menu.Item key="tasks" icon={<UnorderedListOutlined />}>
            <Link to="/tasks">Задачи</Link>
          </Menu.Item>
          <Menu.Item key="graph" icon={<ApartmentOutlined />}>
            <Link to="/graph">Граф</Link>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 24, display: 'flex', alignItems: 'center' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Корпоративный планировщик задач</Typography.Title>
        </Header>
        <Content style={{ margin: 24 }}>
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



