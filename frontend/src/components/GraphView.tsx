import { useMemo, useState, useEffect, useRef } from 'react'
import ReactFlow, { Background, Controls, MiniMap, MarkerType, Node as RFNode, Edge as RFEdge, useEdgesState, useNodesState, Position, Handle, BaseEdge, getSimpleBezierPath, type EdgeProps } from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { Card, Space, Tag, Button, Tooltip } from 'antd'
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
  redundant?: boolean
}

type GraphAnalysis = {
  project_id: number
  duration: number
  critical_path: number[]
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const STATUS_STYLE: Record<GraphNode['status'], { bg: string; border: string; glow: string }> = {
  done: { bg: '#00b96f', border: '#008a4e', glow: 'rgba(0,185,111,0.9)' },
  in_progress: { bg: '#c7a700', border: '#8b7700', glow: 'rgba(199,167,0,0.9)' },
  review: { bg: '#c7a700', border: '#8b7700', glow: 'rgba(199,167,0,0.9)' },
  backlog: { bg: '#b10000', border: '#7c0000', glow: 'rgba(177,0,0,0.9)' }
}

const EDGE_COLOR_FROM_STATUS: Record<GraphNode['status'], string> = {
  done: '#00ff9d',
  in_progress: '#ffde5a',
  review: '#ffde5a',
  backlog: '#ff5555'
}

function buildLayout(data: GraphAnalysis): { nodes: RFNode[]; edges: RFEdge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 150, ranksep: 180 })
  g.setDefaultEdgeLabel(() => ({}))

  const width = 54
  const height = 54
  data.nodes.forEach(n => g.setNode(String(n.id), { width, height }))
  data.edges.forEach(e => g.setEdge(String(e.source), String(e.target)))
  dagre.layout(g)

  const criticalSet = new Set<number>(data.critical_path)
  const rfNodes: RFNode[] = data.nodes.map(n => {
    const pos = g.node(String(n.id))
    const style = STATUS_STYLE[n.status]
    return {
      id: String(n.id),
      type: 'statusNode',
      position: { x: (pos?.x || 0) - width / 2, y: (pos?.y || 0) - height / 2 },
      data: { node: n, style },
      sourcePosition: Position.Right,
      targetPosition: Position.Left
    }
  })

  // Pre-compute offsets for edges converging to the same target to reduce overlap
  const posById: Record<number, { x: number; y: number }> = {}
  data.nodes.forEach(n => {
    const p = g.node(String(n.id))
    posById[n.id] = { x: p?.x || 0, y: p?.y || 0 }
  })
  const incomingByTarget: Record<number, Array<{ e: GraphEdge; sy: number }>> = {}
  data.edges.forEach(e => {
    const arr = incomingByTarget[e.target] || (incomingByTarget[e.target] = [])
    arr.push({ e, sy: posById[e.source]?.y || 0 })
  })
  Object.values(incomingByTarget).forEach(arr => arr.sort((a, b) => a.sy - b.sy))
  const offsetMap: Record<string, number> = {}
  Object.entries(incomingByTarget).forEach(([target, arr]) => {
    const n = arr.length
    arr.forEach((item, idx) => {
      const key = `${item.e.source}->${item.e.target}`
      const offset = (idx - (n - 1) / 2) * 12 // px
      offsetMap[key] = offset
    })
  })

  const sortedEdges = [...data.edges].sort((a, b) => Number(!!a.redundant) - Number(!!b.redundant))
  const rfEdges: RFEdge[] = sortedEdges.map(e => {
    const sourceNode = data.nodes.find(n => n.id === e.source)!
    const color = EDGE_COLOR_FROM_STATUS[sourceNode.status]
    const targetNode = data.nodes.find(n => n.id === e.target)!
    const targetColor = EDGE_COLOR_FROM_STATUS[targetNode.status]
    const isCritical = criticalSet.has(e.source) && criticalSet.has(e.target)
    const offset = offsetMap[`${e.source}->${e.target}`] || 0
    const isDimmed = !!e.redundant
    return {
      id: `${e.source}->${e.target}`,
      source: String(e.source),
      target: String(e.target),
      type: 'gradient',
      sourceHandle: 'r',
      targetHandle: 'l',
      style: { stroke: color, strokeWidth: isCritical ? 6 : isDimmed ? 2 : 3, opacity: isDimmed ? 0.35 : 0.95, strokeDasharray: isDimmed ? '6 8' : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color: targetColor },
      data: { sourceColor: color, targetColor, offset },
      animated: false
    }
  })

  return { nodes: rfNodes, edges: rfEdges }
}

function StatusNode({ data }: { data: { node: GraphNode; style: { bg: string; border: string; glow: string } } }) {
  const { bg, border, glow } = data.style
  const icon = (() => {
    if (data.node.status === 'done') {
      return (
        <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
      )
    }
    if (data.node.status === 'backlog') {
      return (
        <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      )
    }
    // in_progress / review -> gear
    return (
      <path d="M19.14,12.94a7.49,7.49,0,0,0,.05-.94,7.49,7.49,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13.77,2H10.23a.5.5,0,0,0-.5.42L9.35,5.07a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L4.86,11.06a7.49,7.49,0,0,0-.05.94,7.49,7.49,0,0,0,.05.94L2.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.5.42h3.54a.5.5,0,0,0,.5-.42l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
    )
  })()

  return (
    <div style={{ width: 54, height: 54, borderRadius: 999, background: bg, border: `4px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 4px ${border}66, 0 0 38px ${glow}, 0 0 70px ${glow}`, position: 'relative' }}>
      <Handle type="target" position={Position.Left} id="l" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0 }} />
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">{icon}</svg>
    </div>
  )
}

const nodeTypes = { statusNode: StatusNode }

function GradientBezierEdge(props: EdgeProps) {
  const strokeWidth = (props.style as any)?.strokeWidth || 3
  const src = (props.data as any)?.sourceColor || '#999'
  const dst = (props.data as any)?.targetColor || '#999'
  const offset = (props.data as any)?.offset || 0
  const gradId = `grad-${props.id}`

  // Bezier path with slight vertical offsets to reduce overlap but preserve smooth curves
  const [edgePath] = getSimpleBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY + offset * 0.4,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY - offset * 0.4,
    targetPosition: props.targetPosition,
  } as any)
  return (
    <g>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={props.sourceX} y1={props.sourceY} x2={props.targetX} y2={props.targetY}>
          <stop offset="0%" stopColor={src} />
          <stop offset="100%" stopColor={dst} />
        </linearGradient>
      </defs>
      <BaseEdge id={props.id} path={edgePath} style={{ ...props.style, stroke: `url(#${gradId})`, strokeWidth, strokeLinecap: 'round' }} markerEnd={props.markerEnd} />
    </g>
  )
}

const edgeTypes = { gradient: GradientBezierEdge }

export default function GraphView({ projectId, apiBase, readonly = false, showDuration = true }: { projectId: number, apiBase: string, readonly?: boolean; showDuration?: boolean }) {
  const [data, setData] = useState<GraphAnalysis | null>(null)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [clickNode, setClickNode] = useState<GraphNode | null>(null)
  const [clickNodeMeta, setClickNodeMeta] = useState<RFNode | null>(null)
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 })
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const { graphRefreshTick } = useProjectStore()
  const criticalSet = useMemo(() => new Set<number>(data?.critical_path || []), [data])
  const canAct = useMemo(() => {
    if (!data || !clickNode) return { canStart: true, canDone: true }
    const preds = data.edges.filter(e => e.target === clickNode.id).map(e => e.source)
    if (preds.length === 0) return { canStart: true, canDone: true }
    const allPredsDone = preds.every(pid => data.nodes.find(n => n.id === pid)?.status === 'done')
    const canStart = allPredsDone
    // Done allowed only if predecessors done AND current status is in_progress
    const canDone = allPredsDone && clickNode.status === 'in_progress'
    return { canStart, canDone }
  }, [data, clickNode])

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] } as { nodes: RFNode[]; edges: RFEdge[] }
    return buildLayout(data)
  }, [data])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    if (!projectId) return
    fetch(`${apiBase}/analysis/projects/${projectId}/graph`).then(r => {
      if (!r.ok) throw new Error('Failed to load graph')
      return r.json()
    }).then((g: GraphAnalysis) => setData(g)).catch(() => setData(null))
  }, [projectId, apiBase, graphRefreshTick])

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // Keep floating panel next to node and inside viewport
  useEffect(() => {
    if (!clickNodeMeta || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const { x: tx, y: ty, zoom } = viewport
    const posAbs = (clickNodeMeta as any)?.positionAbsolute || { x: 0, y: 0 }
    const NODE_W = 54
    const panelW = 280
    const panelH = 180
    // Flow->screen transform
    let sx = (posAbs.x + NODE_W + 12) * zoom + tx
    let sy = (posAbs.y - 12) * zoom + ty
    // Clamp within container
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
    sx = clamp(sx, 8, rect.width - panelW - 8)
    sy = clamp(sy, 8, rect.height - panelH - 8)
    setPanelPos({ x: sx, y: sy })
  }, [clickNodeMeta, viewport])

  const bg = '#0a0d12'
  const containerStyle = isFullscreen
    ? { position: 'fixed' as const, inset: 0, width: '100vw', height: '100vh', zIndex: 1000, border: 'none', borderRadius: 0, background: bg, overflow: 'hidden' }
    : { width: '100%', height: readonly ? 360 : 'calc(100vh - 220px)', background: bg, overflow: 'hidden' }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {showDuration && (
        <div>
          {data ? (
            <span>Длительность проекта: <b>{data.duration}</b></span>
          ) : (
            <span>Нет данных для отображения</span>
          )}
        </div>
      )}
      <div style={containerStyle} ref={containerRef}>
        <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 1001, display: 'flex', gap: 8, alignItems: 'center' }}>
          {data && (
            <div style={{ background: '#0f0f0f', border: '1px solid #2b2b2b', color: '#9fb0c7', borderRadius: 8, padding: '6px 10px' }}>
              Проект #{data.project_id} · Длит.: <b style={{ color: '#e8e8e8' }}>{data.duration}</b>
            </div>
          )}
          {!readonly && (
            <Button size="small" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? 'Закрыть' : 'Во весь экран'}</Button>
          )}
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onNodeMouseEnter={(_, n) => setHoverNode((n.data as any)?.node)}
          onNodeMouseLeave={() => setHoverNode(null)}
          onNodeClick={(evt, n) => {
            if (readonly) return
            setClickNode((n.data as any)?.node)
            setClickNodeMeta(n)
          }}
          onPaneClick={() => { setClickNode(null); setPanelPos(null) }}
          onMove={(_, v) => setViewport(v)}
          defaultEdgeOptions={{ type: 'gradient' }}
          panOnScroll
          selectionOnDrag={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#16202c" gap={24} />
          {!readonly && <MiniMap style={{ background: '#0f131a', border: '1px solid #2b2b2b', borderRadius: 8, right: 16, bottom: 16 }} nodeStrokeColor="#384355" nodeColor="#1e2735" maskColor="rgba(11,15,21,0.65)" />}
          <Controls position="bottom-right" style={{ right: 16, bottom: 190 }} />
        </ReactFlow>

        {!readonly && clickNode && panelPos && (
          <div style={{ position: 'absolute', left: panelPos.x, top: panelPos.y, width: 280, background: '#0f0f0f', border: '1px solid #2b2b2b', borderRadius: 10, zIndex: 1002, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
            <div style={{ fontWeight: 600, color: '#e8e8e8' }}>{clickNode.name}</div>
            <div style={{ color: '#9fb0c7', fontSize: 12 }}>ID: <b style={{ color: '#e8e8e8' }}>#{clickNode.id}</b></div>
            <div style={{ color: '#bbb' }}>Статус: <Tag>{clickNode.status}</Tag></div>
            <div style={{ color: '#bbb' }}>Длительность: {clickNode.duration}</div>
            <div style={{ color: '#aaa' }}>ES/EF: {clickNode.es}/{clickNode.ef} · LS/LF: {clickNode.ls}/{clickNode.lf} · Slack: {clickNode.slack}</div>
            {criticalSet.has(clickNode.id) && <Tag color="red">Критический путь</Tag>}
            <Space wrap size={[8, 8]}>
              <Tooltip title={!canAct.canDone ? (clickNode.status !== 'in_progress' ? "Нельзя завершить: задача не 'in_progress'" : 'Сначала завершите все предшественники') : undefined}>
                <Button size="small" disabled={!canAct.canDone} icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} onClick={async () => { await updateTask(clickNode.id, { status: 'done' }); setClickNode(null); setData(null); fetch(`${apiBase}/analysis/projects/${projectId}/graph`).then(r=>r.json()).then(setData) }}>Done</Button>
              </Tooltip>
              <Tooltip title={!canAct.canStart ? 'Нельзя начать: есть незавершённые предшественники' : undefined}>
                <Button size="small" disabled={!canAct.canStart} icon={<SyncOutlined spin={false} />} onClick={async () => { await updateTask(clickNode.id, { status: 'in_progress' }); setClickNode(null); setData(null); fetch(`${apiBase}/analysis/projects/${projectId}/graph`).then(r=>r.json()).then(setData) }}>In Progress</Button>
              </Tooltip>
              <Button size="small" icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />} onClick={async () => { await updateTask(clickNode.id, { status: 'backlog' }); setClickNode(null); setData(null); fetch(`${apiBase}/analysis/projects/${projectId}/graph`).then(r=>r.json()).then(setData) }}>Backlog</Button>
            </Space>
          </div>
        )}
      </div>

      {/* убрали всплывающие карточки; информация доступна в правой панели */}
    </div>
  )
}



