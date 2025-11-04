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


