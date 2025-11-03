import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { Core, EdgeDefinition, ElementDefinition, NodeDefinition } from 'cytoscape'
import { Card, Popover, Space, Tag, Button } from 'antd'
import { CheckCircleTwoTone, SyncOutlined, CloseCircleTwoTone } from '@ant-design/icons'
import { updateTask } from '../api/client'
import { useProjectStore } from '../store/useProjectStore'

type GraphNode = {
  id: number
  name: string
  duration: number
  es: number
  ef: number
  ls: number
  lf: number
  slack: number
  is_critical: boolean
  status: 'backlog' | 'in_progress' | 'review' | 'done'
}

type GraphEdge = {
  source: number
  target: number
  dependency_type: string
}

type GraphAnalysis = {
  project_id: number
  duration: number
  critical_path: number[]
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export default function GraphView({ projectId, apiBase }: { projectId: number, apiBase: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [cy, setCy] = useState<Core | null>(null)
  const [data, setData] = useState<GraphAnalysis | null>(null)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [clickNode, setClickNode] = useState<GraphNode | null>(null)
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null)
  const { graphRefreshTick } = useProjectStore()

  // Inline SVG icons for node background
  const ICON_CHECK = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>')
  const ICON_GEAR = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M19.14,12.94a7.49,7.49,0,0,0,.05-.94,7.49,7.49,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13.77,2H10.23a.5.5,0,0,0-.5.42L9.35,5.07a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L4.86,11.06a7.49,7.49,0,0,0-.05.94,7.49,7.49,0,0,0,.05.94L2.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.5.42h3.54a.5.5,0,0,0,.5-.42l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>')
  const ICON_CROSS = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>')

  useEffect(() => {
    if (!containerRef.current) return
    const instance = cytoscape({
      container: containerRef.current,
      style: [
        // base node
        { selector: 'node', style: { 'width': 50, 'height': 50, 'background-color': '#222', 'border-width': 3, 'border-color': '#2a2a2a', 'background-opacity': 1, 'background-fit': 'contain', 'background-clip': 'none', 'shadow-blur': 20, 'shadow-opacity': 0.85 } },
        // base edge (default)
        { selector: 'edge', style: { 'width': 3, 'line-color': '#9cff57', 'target-arrow-color': '#9cff57', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
        { selector: '.edge-default', style: { 'line-color': '#9cff57', 'target-arrow-color': '#9cff57' } },
        { selector: '.edge-from-done', style: { 'line-color': '#00ff9d', 'target-arrow-color': '#00ff9d' } },
        { selector: '.edge-from-progress', style: { 'line-color': '#ffde5a', 'target-arrow-color': '#ffde5a' } },
        { selector: '.edge-from-backlog', style: { 'line-color': '#ff5555', 'target-arrow-color': '#ff5555' } },
        // statuses -> neon styles + icons
        { selector: '.status-done', style: { 'background-color': '#00b96f', 'border-color': '#5fffac', 'shadow-color': '#00ff9d', 'background-image': ICON_CHECK } },
        { selector: '.status-progress', style: { 'background-color': '#c7a700', 'border-color': '#fff67f', 'shadow-color': '#ffde5a', 'background-image': ICON_GEAR } },
        { selector: '.status-backlog', style: { 'background-color': '#b10000', 'border-color': '#ff7777', 'shadow-color': '#ff5555', 'background-image': ICON_CROSS } },
        // critical accents
        { selector: '.critical', style: { 'border-color': '#ff4d4f', 'shadow-color': '#ff4d4f' } },
        { selector: '.critical-edge', style: { 'line-color': '#ff3b3b', 'target-arrow-color': '#ff3b3b', 'width': 4 } },
        // done-done edge should override any highlight
        { selector: '.edge-done', style: { 'line-color': '#5fffac', 'target-arrow-color': '#5fffac', 'opacity': 1 } },
        // hovered ring like blue glow
        { selector: '.hovered', style: { 'border-color': '#00e5ff', 'shadow-color': '#00e5ff', 'shadow-blur': 28 } },
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 20, spacingFactor: 1.2 }
    })
    setCy(instance)
    return () => { instance.destroy() }
  }, [])

  useEffect(() => {
    if (!projectId) return
    fetch(`${apiBase}/analysis/projects/${projectId}/graph`).then(r => {
      if (!r.ok) throw new Error('Failed to load graph')
      return r.json()
    }).then((g: GraphAnalysis) => {
      setData(g)
    }).catch((e) => {
      console.error(e)
      setData(null)
    })
  }, [projectId, apiBase, graphRefreshTick])

  const elements: ElementDefinition[] = useMemo(() => {
    if (!data) return []
    const nodeDefs: NodeDefinition[] = data.nodes.map(n => ({
      data: {
        id: String(n.id),
        label: ''
      },
      classes: [
        n.is_critical ? 'critical' : '',
        n.status === 'done' ? 'status-done' : (n.status === 'in_progress' || n.status === 'review') ? 'status-progress' : 'status-backlog'
      ].filter(Boolean).join(' ')
    }))
    const idToStatus = new Map<number, GraphNode['status']>(data.nodes.map(n => [n.id, n.status]))
    const edgeDefs: EdgeDefinition[] = data.edges.map(e => {
      const srcStatus = idToStatus.get(e.source)
      const dstStatus = idToStatus.get(e.target)
      const bothDone = srcStatus === 'done' && dstStatus === 'done'
      const isCritical = data.critical_path.includes(e.source) && data.critical_path.includes(e.target)
      const fromClass = srcStatus === 'done' ? 'edge-from-done' : (srcStatus === 'in_progress' || srcStatus === 'review') ? 'edge-from-progress' : 'edge-from-backlog'
      const classes = [fromClass, isCritical ? 'critical-edge' : 'edge-default', bothDone ? 'edge-done' : ''].filter(Boolean).join(' ')
      return { data: { id: `${e.source}->${e.target}`, source: String(e.source), target: String(e.target) }, classes }
    })
    return [...nodeDefs, ...edgeDefs]
  }, [data])

  useEffect(() => {
    if (!cy) return
    cy.elements().remove()
    if (!elements.length) return
    cy.add(elements)
    cy.layout({ name: 'breadthfirst', directed: true, padding: 20, spacingFactor: 1.2 }).run()
    cy.fit(undefined, 20)
    cy.on('mouseover', 'node', (evt) => {
      const n = evt.target.data()
      const node = data?.nodes.find(x => String(x.id) === n.id) || null
      setHoverNode(node)
      evt.target.addClass('hovered')
    })
    cy.on('mouseout', 'node', (evt) => { setHoverNode(null); evt.target.removeClass('hovered') })
    cy.on('tap', 'node', (evt) => {
      const n = evt.target.data()
      const node = data?.nodes.find(x => String(x.id) === n.id) || null
      setClickNode(node || null)
      const pos = evt.renderedPosition || evt.position
      const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect()
      setClickPos({ x: rect.left + pos.x, y: rect.top + pos.y })
    })
  }, [elements, cy])

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        {data ? (
          <span>Длительность проекта: <b>{data.duration}</b></span>
        ) : (
          <span>Нет данных для отображения</span>
        )}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 600, border: '1px solid #2b2b2b', borderRadius: 6, background: '#1a1a1a' }} />
      {hoverNode && (
        <Card size="small" style={{ position: 'absolute', left: 12, bottom: 12, background: '#111', color: '#eee', borderColor: '#333' }}>
          <Space direction="vertical" size={2}>
            <div><b>{hoverNode.name}</b></div>
            <div>Статус: <Tag>{hoverNode.status}</Tag></div>
            <div>Длительность: {hoverNode.duration}</div>
            <div>ES/EF: {hoverNode.es}/{hoverNode.ef} · LS/LF: {hoverNode.ls}/{hoverNode.lf} · Slack: {hoverNode.slack}</div>
            {hoverNode.is_critical && <Tag color="red">Критический путь</Tag>}
          </Space>
        </Card>
      )}
      {clickNode && clickPos && (
        <div style={{ position: 'fixed', left: clickPos.x + 12, top: clickPos.y + 12, zIndex: 10 }}>
          <Card size="small" title={clickNode.name} extra={<a onClick={() => setClickNode(null)}>Закрыть</a>}>
            <Space>
              <Button icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} onClick={async () => { await updateTask(clickNode.id, { status: 'done' }); setClickNode(null); setData(null); fetch(`${apiBase}/analysis/projects/${projectId}/graph`).then(r=>r.json()).then(setData) }}>Done</Button>
              <Button icon={<SyncOutlined spin={false} />} onClick={async () => { await updateTask(clickNode.id, { status: 'in_progress' }); setClickNode(null); setData(null); fetch(`${apiBase}/analysis/projects/${projectId}/graph`).then(r=>r.json()).then(setData) }}>In Progress</Button>
              <Button icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />} onClick={async () => { await updateTask(clickNode.id, { status: 'backlog' }); setClickNode(null); setData(null); fetch(`${apiBase}/analysis/projects/${projectId}/graph`).then(r=>r.json()).then(setData) }}>Backlog</Button>
            </Space>
          </Card>
        </div>
      )}
    </div>
  )
}



