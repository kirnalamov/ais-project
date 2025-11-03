import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Space, Tag, theme } from 'antd'

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

const STATUS_STYLE: Record<GraphNode['status'], { fill: string; border: string; text: string }> = {
  // aligned with Ant Design colors
  done: { fill: '#52c41a', border: '#389e0d', text: '#0b1a0b' },
  in_progress: { fill: '#faad14', border: '#d48806', text: '#1f1400' },
  review: { fill: '#faad14', border: '#d48806', text: '#1f1400' },
  backlog: { fill: '#ff7875', border: '#cf1322', text: '#2a0d0d' },
}

export default function GanttView({ projectId, apiBase }: { projectId: number; apiBase: string }) {
  const { token } = theme.useToken()
  const [data, setData] = useState<GraphAnalysis | null>(null)
  const [scale, setScale] = useState<number>(32) // px per time unit (wider by default)
  const [heightPerRow] = useState<number>(44)
  const [labelWidth, setLabelWidth] = useState<number>(300)
  const [labelTextMaxWidth, setLabelTextMaxWidth] = useState<number>(0)
  const headerH = 40
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const labelMeasureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!projectId) return
    fetch(`${apiBase}/analysis/projects/${projectId}/graph`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load graph')
        return r.json()
      })
      .then((g: GraphAnalysis) => setData(g))
      .catch(() => setData(null))
  }, [projectId, apiBase])

  const rows = useMemo(() => {
    if (!data) return [] as GraphNode[]
    return [...data.nodes].sort((a, b) => a.es - b.es || a.id - b.id)
  }, [data])

  // Auto scale to fit container width (can exceed 80 px/unit)
  useEffect(() => {
    const fit = () => {
      if (!data || !containerRef.current) return
      const cw = containerRef.current.clientWidth || 0
      const total = Math.max(1, data.duration)
      const available = Math.max(200, cw - labelWidth - 60)
      const computed = available / total
      const min = 16
      const next = Math.max(min, Math.round(computed))
      setScale(next)
    }
    fit()
    const ro = new ResizeObserver(() => fit())
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [data, labelWidth, labelTextMaxWidth])

  useEffect(() => {
    if (!labelMeasureRef.current) return
    const texts = rows.map((n) => `#${n.id} · ${n.name}`)
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.font = getComputedStyle(labelMeasureRef.current).font as string
    const max = texts.reduce((m, t) => Math.max(m, ctx.measureText(t).width), 0)
    setLabelTextMaxWidth(max)
    setLabelWidth(Math.min(900, Math.max(320, Math.ceil(max) + 44)))
  }, [rows])

  const totalDuration = data?.duration || 0
  const width = labelWidth + totalDuration * scale + 120
  const height = headerH + rows.length * heightPerRow + 20

  if (!data) {
    return <Empty description="Нет данных для диаграммы" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#9fb0c7' }}>Время: {totalDuration} ед.</div>
        <Space>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f0f0f', border: '1px solid #2b2b2b', padding: '4px 8px', borderRadius: 8 }}>
            <Button size="small" onClick={() => setScale((s) => Math.max(8, Math.round(s * 0.85)))}>−</Button>
            <div style={{ minWidth: 92, textAlign: 'center', color: '#c9d7ef' }}>{scale} px/ед.</div>
            <Button size="small" onClick={() => setScale((s) => Math.min(400, Math.round(s * 1.2)))}>+</Button>
          </div>
          <Button size="small" onClick={() => {
            if (!svgRef.current) return
            const clone = svgRef.current.cloneNode(true) as SVGSVGElement
            if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
            if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
            const serializer = new XMLSerializer()
            const svgStr = serializer.serializeToString(clone)
            const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `gantt_project_${data?.project_id || ''}.svg`
            a.click()
            setTimeout(() => URL.revokeObjectURL(a.href), 0)
          }}>Сохранить SVG</Button>
        </Space>
      </div>

      <div ref={containerRef} style={{ width: '100%', overflow: 'auto', borderRadius: 8, border: '1px solid #2b2b2b', background: '#0f131a' }}>
        <svg ref={svgRef} width={Math.max(width, containerRef.current?.clientWidth || 0)} height={height} style={{ display: 'block' }}>
          <defs>
            <pattern id="minor-grid" width={scale} height={heightPerRow} patternUnits="userSpaceOnUse">
              <rect width={scale} height={heightPerRow} fill="#0f131a" />
              <path d={`M ${scale} 0 V ${heightPerRow}`} stroke="#1b2330" strokeWidth="1" />
            </pattern>
            <pattern id="major-grid" width={scale * 5} height={heightPerRow} patternUnits="userSpaceOnUse">
              <rect width={scale * 5} height={heightPerRow} fill="url(#minor-grid)" />
              <path d={`M ${scale * 5} 0 V ${heightPerRow}`} stroke="#2a3750" strokeWidth="1" />
            </pattern>
            <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
            </filter>
            <filter id="crit-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#ff4d4f" floodOpacity="0.8" />
            </filter>
            <marker id="arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#3b4e69" />
            </marker>
          </defs>

          {/* header background */}
          <rect x={0} y={0} width={width} height={headerH} fill="#0a0d12" />

          {/* labels background */}
          <rect x={0} y={headerH} width={labelWidth} height={rows.length * heightPerRow} fill="#0b0f16" />

          {/* time grid */}
          <g transform={`translate(${labelWidth}, ${headerH})`}>
            {Array.from({ length: totalDuration }).map((_, i) => (
              <rect key={i} x={i * scale} y={0} width={scale} height={rows.length * heightPerRow} fill={i % 5 === 4 ? 'url(#major-grid)' : 'url(#minor-grid)'} />
            ))}
          </g>

          {/* header ticks & labels */}
          <g transform={`translate(${labelWidth}, 0)`}>
            {Array.from({ length: totalDuration + 1 }).map((_, i) => (
              <g key={i}>
                <line x1={i * scale} y1={headerH - 12} x2={i * scale} y2={headerH} stroke={i % 5 === 0 ? '#3b4e69' : '#2a3750'} strokeWidth={i % 5 === 0 ? 2 : 1} />
                {i % 5 === 0 && (
                  <text x={i * scale + 4} y={22} fill="#9fb0c7" fontSize={12} fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial">{i}</text>
                )}
              </g>
            ))}
          </g>

          {/* row separators */}
          <g transform={`translate(0, ${headerH})`}>
            {rows.map((_, idx) => (
              <line key={idx} x1={0} y1={(idx + 1) * heightPerRow} x2={width} y2={(idx + 1) * heightPerRow} stroke="#0f1a26" strokeWidth={1} />
            ))}
          </g>

          {/* row labels */}
          <g transform={`translate(0, ${headerH})`}>
            {rows.map((n, idx) => {
              const infoW = 108
              const nameW = Math.max(60, labelWidth - infoW - 12)
              const y = idx * heightPerRow
              return (
                <g key={n.id}>
              <foreignObject x={8} y={y + 6} width={nameW} height={heightPerRow - 12}>
                <div style={{ color: '#c9d7ef', fontSize: 15, lineHeight: 1.2, fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial', whiteSpace: 'nowrap' as any, overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'keep-all' as any }}>
                      #{n.id} · {n.name}
                    </div>
                  </foreignObject>
                  <text x={labelWidth - 8} y={y + heightPerRow * 0.66} textAnchor="end" fill="#7c8fa9" fontSize={12} fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial">
                    ES {n.es} · EF {n.ef}
                  </text>
                </g>
              )
            })}
          </g>

          {/* arrows between tasks based on dependencies */}
          <g transform={`translate(${labelWidth}, ${headerH})`}>
            {data.edges.map((e) => {
              const src = rows.find((n) => n.id === e.source)
              const dst = rows.find((n) => n.id === e.target)
              if (!src || !dst) return null
              const x1 = src.ef * scale
              const y1 = rows.indexOf(src) * heightPerRow + (heightPerRow / 2)
              const x2 = dst.es * scale
              const y2 = rows.indexOf(dst) * heightPerRow + (heightPerRow / 2)
              const dx = Math.max(24, x2 - x1)
              const c1x = x1 + dx * 0.35
              const c2x = x2 - dx * 0.35
              return (
                <path key={`${e.source}->${e.target}`} d={`M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`} stroke="#3b4e69" strokeWidth={1.6} fill="none" markerEnd="url(#arrow-head)" opacity={e.redundant ? 0.4 : 0.9} />
              )
            })}
          </g>

          {/* bars */}
          <g transform={`translate(${labelWidth}, ${headerH})`}>
            {rows.map((n, idx) => {
              const x = n.es * scale + 1
              const w = Math.max(6, n.duration * scale - 2)
              const y = idx * heightPerRow + 6
              const h = heightPerRow - 12
              const s = STATUS_STYLE[n.status]
              const isCrit = n.is_critical
              return (
                <g key={n.id} filter={isCrit ? 'url(#crit-glow)' : 'url(#soft-shadow)'}>
                  <rect x={x} y={y} width={w} height={h} rx={8} ry={8} fill={s.fill} stroke={isCrit ? '#ff4d4f' : s.border} strokeWidth={2} />
                  <clipPath id={`clip-${n.id}`}><rect x={x + 8} y={y + 4} width={w - 16} height={h - 8} rx={6} ry={6} /></clipPath>
                  <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fill={s.text} fontWeight={700} fontSize={12} fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" clipPath={`url(#clip-${n.id})`}>
                    {n.duration} ед.
                    <title>{`ID #${n.id} · ${n.name}`}</title>
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
        <div ref={labelMeasureRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', fontSize: 15, fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>Measure</div>
      </div>

      {/* legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#9fb0c7' }}>
        <span>Легенда:</span>
        <Tag color="red" style={{ marginRight: 0 }}>Критический</Tag>
        <Tag color="green" style={{ marginRight: 0 }}>Done</Tag>
        <Tag color="gold" style={{ marginRight: 0 }}>In progress/Review</Tag>
        <Tag color="volcano" style={{ marginRight: 0 }}>Backlog</Tag>
      </div>
    </div>
  )
}


