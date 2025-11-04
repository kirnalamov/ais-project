from collections import deque, defaultdict
from typing import Dict, List, Tuple

from .. import models, schemas


def build_graph_and_cpm(project_id: int, tasks: List[models.Task], dependencies: List[models.TaskDependency]) -> schemas.GraphAnalysis:
    id_to_task = {t.id: t for t in tasks}
    # Для текущего планирования учитываем выполненные задачи как нулевой остаток
    durations: Dict[int, int] = {
        t.id: (0 if t.status == models.TaskStatus.done else max(0, int(t.duration_plan)))
        for t in tasks
    }

    adjacency: Dict[int, List[int]] = defaultdict(list)
    reverse_adj: Dict[int, List[int]] = defaultdict(list)
    indegree: Dict[int, int] = {t.id: 0 for t in tasks}

    edge_pairs: List[Tuple[int, int]] = []
    for dep in dependencies:
        src = dep.depends_on_task_id
        dst = dep.task_id
        if src not in id_to_task or dst not in id_to_task:
            continue
        adjacency[src].append(dst)
        reverse_adj[dst].append(src)
        indegree[dst] += 1
        edge_pairs.append((src, dst))

    topo_order: List[int] = []
    q: deque[int] = deque([tid for tid, deg in indegree.items() if deg == 0])

    while q:
        u = q.popleft()
        topo_order.append(u)
        for v in adjacency.get(u, []):
            indegree[v] -= 1
            if indegree[v] == 0:
                q.append(v)

    if len(topo_order) != len(tasks):
        # Cycle detected or disconnected input; for robustness we still attempt calculations on DAG part
        # but better to raise an error
        raise ValueError("Task graph contains a cycle; CPM requires a DAG")

    es: Dict[int, int] = {tid: 0 for tid in id_to_task}
    ef: Dict[int, int] = {tid: 0 for tid in id_to_task}

    for u in topo_order:
        es[u] = max((ef[p] for p in reverse_adj.get(u, [])), default=0)
        ef[u] = es[u] + durations[u]

    project_duration = max((ef[u] for u in topo_order), default=0)

    lf: Dict[int, int] = {tid: project_duration for tid in id_to_task}
    ls: Dict[int, int] = {tid: 0 for tid in id_to_task}

    for u in reversed(topo_order):
        lf[u] = min((ls[c] for c in adjacency.get(u, [])), default=project_duration)
        ls[u] = lf[u] - durations[u]

    slack: Dict[int, int] = {tid: ls[tid] - es[tid] for tid in id_to_task}
    critical_nodes = {tid for tid, s in slack.items() if s == 0}

    # Recover a single deterministic critical path
    critical_path: List[int] = []
    # Start from a source critical node
    start_candidates = [tid for tid in topo_order if tid in critical_nodes and es[tid] == 0]
    if start_candidates:
        u = sorted(start_candidates)[0]
        critical_path.append(u)
        while True:
            next_candidates = [
                v
                for v in adjacency.get(u, [])
                if v in critical_nodes and es[v] == ef[u]
            ]
            if not next_candidates:
                break
            u = sorted(next_candidates)[0]
            critical_path.append(u)

    nodes: List[schemas.GraphNode] = [
        schemas.GraphNode(
            id=tid,
            name=id_to_task[tid].name,
            duration=durations[tid],
            es=es[tid],
            ef=ef[tid],
            ls=ls[tid],
            lf=lf[tid],
            slack=slack[tid],
            is_critical=tid in critical_nodes,
            status=id_to_task[tid].status,
        )
        for tid in topo_order
    ]

    # Mark transitive edges for visualization (keep them but style as dashed/transparent)
    # Edge u->v is redundant if there exists an alternative path from u to v
    def has_alternative_path(u: int, v: int) -> bool:
        stack = list(adjacency.get(u, []))
        # skip the direct edge u->v
        stack = [x for x in stack if x != v]
        seen = set([u])
        while stack:
            w = stack.pop()
            if w == v:
                return True
            if w in seen:
                continue
            seen.add(w)
            for nxt in adjacency.get(w, []):
                if nxt not in seen:
                    stack.append(nxt)
        return False

    dep_type_map: Dict[Tuple[int, int], models.DependencyType] = {}
    for dep in dependencies:
        dep_type_map[(dep.depends_on_task_id, dep.task_id)] = dep.dependency_type

    edges: List[schemas.GraphEdge] = []
    for (u, v) in edge_pairs:
        edges.append(
            schemas.GraphEdge(
                source=u,
                target=v,
                dependency_type=dep_type_map[(u, v)],
                redundant=has_alternative_path(u, v),
            )
        )

    return schemas.GraphAnalysis(
        project_id=project_id,
        duration=project_duration,
        critical_path=critical_path,
        nodes=nodes,
        edges=edges,
    )



