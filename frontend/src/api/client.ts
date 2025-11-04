const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
import { useAuthStore } from '../store/useAuthStore'

function authHeaders() {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type Project = {
  id: number
  name: string
  description?: string
}

export type ProjectDetail = Project & {
  manager_id?: number
  deadline?: string
  customer?: string
  budget_plan?: number
  created_at?: string
  updated_at?: string
}

export type Task = {
  id: number
  name: string
  description?: string
  project_id: number
  assignee_id?: number
  status: 'backlog' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high'
  duration_plan: number
}

export async function listProjects(): Promise<Project[]> {
  const r = await fetch(`${API_BASE}/projects/`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to load projects')
  return r.json()
}

export async function getProject(projectId: number): Promise<ProjectDetail> {
  const r = await fetch(`${API_BASE}/projects/${projectId}`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to load project')
  return r.json()
}

export async function updateProject(projectId: number, payload: Partial<{ name: string; description: string; deadline: string; customer: string; manager_id: number; budget_plan: number }>): Promise<ProjectDetail> {
  const r = await fetch(`${API_BASE}/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('Failed to update project')
  return r.json()
}

export async function deleteProject(projectId: number): Promise<void> {
  const r = await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE', headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to delete project')
}

export async function deleteProjectMember(projectId: number, userId: number): Promise<any> {
  const r = await fetch(`${API_BASE}/projects/${projectId}/members/${userId}`, { method: 'DELETE', headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to remove member')
  return r.json()
}

export async function createProject(payload: { name: string; description?: string; deadline?: string; customer?: string; manager_id?: number; budget_plan?: number }): Promise<Project> {
  const r = await fetch(`${API_BASE}/projects/`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('Failed to create project')
  return r.json()
}

export async function listTasks(projectId: number): Promise<Task[]> {
  const r = await fetch(`${API_BASE}/tasks/?project_id=${projectId}`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to load tasks')
  return r.json()
}

export async function createTask(payload: { name: string; description?: string; project_id: number; assignee_id?: number; status?: string; priority?: string; duration_plan: number; deadline?: string }): Promise<Task> {
  const r = await fetch(`${API_BASE}/tasks/`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('Failed to create task')
  return r.json()
}

export async function createDependency(payload: { task_id: number; depends_on_task_id: number; dependency_type?: 'blocks' }): Promise<any> {
  const r = await fetch(`${API_BASE}/tasks/dependencies`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('Failed to create dependency')
  return r.json()
}

export async function updateTask(taskId: number, payload: Partial<{ name: string; description: string; assignee_id: number; status: Task['status']; priority: Task['priority']; duration_plan: number; deadline: string }>): Promise<Task> {
  const r = await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('Failed to update task')
  return r.json()
}

export async function getTaskDependencies(taskId: number): Promise<Array<{ id: number; task_id: number; depends_on_task_id: number }>> {
  const r = await fetch(`${API_BASE}/tasks/${taskId}/dependencies`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to load dependencies')
  return r.json()
}

export async function setTaskDependencies(taskId: number, ids: number[]): Promise<any> {
  const r = await fetch(`${API_BASE}/tasks/${taskId}/dependencies`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ depends_on_task_ids: ids }) })
  if (!r.ok) throw new Error('Failed to save dependencies')
  return r.json()
}

export async function login(payload: { email: string; password: string }): Promise<{ access_token: string; token_type: string; user: any }> {
  const r = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('Неверный email или пароль')
  return r.json()
}

export async function me(): Promise<any> {
  const r = await fetch(`${API_BASE}/auth/me`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to load profile')
  return r.json()
}

export async function register(payload: { email: string; full_name: string; password: string; nickname?: string; phone?: string; telegram?: string }): Promise<any> {
  const r = await fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('Failed to register')
  return r.json()
}

export async function searchUsers(q: string): Promise<Array<{ id: number; email: string; full_name: string; nickname?: string; role: string }>> {
  const r = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(q)}`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to search users')
  return r.json()
}

export async function listProjectMembers(projectId: number): Promise<Array<{ id: number; project_id: number; user: any }>> {
  const r = await fetch(`${API_BASE}/projects/${projectId}/members`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to load members')
  return r.json()
}

export async function addProjectMember(projectId: number, userId: number): Promise<any> {
  const r = await fetch(`${API_BASE}/projects/${projectId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ user_id: userId }) })
  if (!r.ok) throw new Error('Failed to add member')
  return r.json()
}

export async function listTaskMessages(taskId: number): Promise<Array<{ id: number; task_id: number; author: any; content: string; created_at: string }>> {
  const r = await fetch(`${API_BASE}/tasks/${taskId}/messages`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error('Failed to load messages')
  return r.json()
}

export async function sendTaskMessage(taskId: number, content: string): Promise<any> {
  const r = await fetch(`${API_BASE}/tasks/${taskId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ content }) })
  if (!r.ok) throw new Error('Failed to send message')
  return r.json()
}


