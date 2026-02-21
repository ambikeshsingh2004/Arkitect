import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  MiniMap,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Layout, Play, Square, Activity, Database, Server, Share2, Users, Zap, ZapOff, Trash2, Copy, Split } from 'lucide-react';

import LoadBalancerNode from './components/nodes/LoadBalancerNode.jsx';
import AppServerNode from './components/nodes/AppServerNode.jsx';
import DatabaseNode from './components/nodes/DatabaseNode.jsx';
import ClientNode from './components/nodes/ClientNode.jsx';
import DBRouterNode from './components/nodes/DBRouterNode.jsx';
import PropertiesPanel from './components/PropertiesPanel.jsx';

const nodeTypes = {
  client: ClientNode,
  loadbalancer: LoadBalancerNode,
  appserver: AppServerNode,
  database: DatabaseNode,
  dbrouter: DBRouterNode,
};

let nodeId = 0;
const getId = () => `node_${++nodeId}`;

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#6366f1', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
  interactionWidth: 20,
};

// Default data per node type
const defaultNodeData = {
  client: { rps: 100, readRatio: 0.7 },
  loadbalancer: { algorithm: 'round-robin', maxRPS: 1000, backpressureEnabled: false },
  appserver: { maxRPS: 200, baseLatency: 20, concurrencyLimit: 0 },
  database: { maxRPS: 100, baseLatency: 50, concurrencyLimit: 0 },
  dbrouter: { readRatio: 0.7 },
};

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [spikeOn, setSpikeOn] = useState(false);
  const [bottleneckIds, setBottleneckIds] = useState([]);
  const [tickCount, setTickCount] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const wsRef = useRef(null);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Get traffic RPS from the first client node, or default 100
  const getTrafficRPS = () => {
    const clientNode = nodes.find((n) => n.type === 'client');
    return clientNode?.data?.rps || 100;
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const nextNodes = applyNodeChanges(changes, nds);
      
      // If a node was deleted via keyboard, sync the change
      if (isRunning && sessionId && changes.some(c => c.type === 'remove')) {
        syncSimulation(nextNodes, edges);
      }
      return nextNodes;
    });
  }, [isRunning, sessionId, edges]);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => {
      const nextEdges = applyEdgeChanges(changes, eds);
      
      // If an edge was deleted via keyboard, sync the change
      if (isRunning && sessionId && changes.some(c => c.type === 'remove')) {
        syncSimulation(nodes, nextEdges);
      }
      return nextEdges;
    });
  }, [isRunning, sessionId, nodes]);

  const onConnect = useCallback((connection) => {
    setEdges((eds) => {
      const nextEdges = addEdge({ ...connection, ...defaultEdgeOptions }, eds);
      if (isRunning && sessionId) {
        syncSimulation(nodes, nextEdges);
      }
      return nextEdges;
    });
  }, [isRunning, sessionId, nodes]);

  // Select node on click
  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Deselect on pane click
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Update node data (from properties panel)
  const updateNodeData = useCallback((nodeId, updates) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
      )
    );
  }, []);

  // Add a replica of a database node
  const addReplica = useCallback((nodeId) => {
    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (!sourceNode || sourceNode.type !== 'database') return;

    const replicaId = getId();
    const replicaLabel = `${sourceNode.data.label} Replica`;

    // Position replica 200px to the right of the source
    const newNode = {
      id: replicaId,
      type: 'database',
      position: {
        x: sourceNode.position.x + 220,
        y: sourceNode.position.y,
      },
      data: {
        label: replicaLabel,
        metrics: null,
        maxRPS: sourceNode.data.maxRPS || 50,
        baseLatency: sourceNode.data.baseLatency || 50,
        isReplica: true,
      },
    };

    // Find all incoming edges to the source node and duplicate them for the replica
    const newEdges = edges
      .filter((e) => e.target === nodeId)
      .map((e) => ({
        id: `e-${e.source}-${replicaId}`,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: replicaId,
        targetHandle: e.targetHandle,
        ...defaultEdgeOptions,
      }));

    setNodes((nds) => {
      const nextNodes = nds.concat(newNode);
      const nextEdges = edges.concat(newEdges);
      if (isRunning && sessionId) syncSimulation(nextNodes, nextEdges);
      return nextNodes;
    });
    setEdges((eds) => eds.concat(newEdges));
  }, [nodes, edges, isRunning, sessionId]);

  const resetQueues = useCallback(async () => {
    if (!isRunning || !sessionId) return;
    try {
      await fetch(`/api/simulate/${sessionId}/reset-queues`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to reset queues:', err);
    }
  }, [isRunning, sessionId]);

  // Sync current architecture to living backend session
  const syncSimulation = async (currentNodes, currentEdges) => {
    if (!isRunning || !sessionId) return;
    
    const trafficRPS = currentNodes.find((n) => n.type === 'client')?.data?.rps || 100;
    const payload = {
      nodes: currentNodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.data.label,
        maxRPS: n.data.maxRPS || (n.type === 'appserver' ? 100 : n.type === 'database' ? 50 : n.type === 'loadbalancer' ? 500 : 0),
        baseLatency: n.data.baseLatency || (n.type === 'appserver' ? 20 : n.type === 'database' ? 50 : 0),
        isReplica: n.data.isReplica || false,
        backpressureEnabled: n.data.backpressureEnabled || false,
        backpressureThreshold: n.data.backpressureThreshold || 0.9,
        algorithm: n.data.algorithm || 'round-robin',
        readRatio: n.data.readRatio || 0.7,
        concurrencyLimit: n.data.concurrencyLimit || (n.type === 'appserver' ? 100 : n.type === 'database' ? 50 : 0),
        rps: n.data.rps || (n.type === 'client' ? 100 : 0),
      })),
      edges: currentEdges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
      trafficRPS: trafficRPS,
    };

    try {
      await fetch(`/api/simulate/${sessionId}/update-graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to sync simulation:', err);
    }
  };

  // Clear all
  const clearAll = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
  };

  // Remove a single node and its connected edges
  const removeNode = useCallback((nodeId) => {
    const nextNodes = nodes.filter((n) => n.id !== nodeId);
    const nextEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(null);

    if (isRunning && sessionId) {
      syncSimulation(nextNodes, nextEdges);
    }
  }, [nodes, edges, isRunning, sessionId]);

  // — Drag-and-drop from sidebar —
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const labelMap = {
        client: 'Client',
        loadbalancer: 'Load Balancer',
        appserver: 'App Server',
        database: 'Database',
        dbrouter: 'DB Router',
      };

      if (type === 'database') {
        const primaryId = getId();
        const primaryNode = {
          id: primaryId,
          type: 'database',
          position,
          data: {
            label: `Primary DB ${primaryId.split('_')[1]}`,
            metrics: null,
            ...defaultNodeData.database,
            isReplica: false,
          },
        };

        const replicaId = getId();
        const replicaNode = {
          id: replicaId,
          type: 'database',
          position: { x: position.x + 220, y: position.y },
          data: {
            label: `Read Replica ${replicaId.split('_')[1]}`,
            metrics: null,
            ...defaultNodeData.database,
            isReplica: true,
          },
        };

        setNodes((nds) => {
          const nextNodes = nds.concat(primaryNode, replicaNode);
          if (isRunning && sessionId) syncSimulation(nextNodes, edges);
          return nextNodes;
        });
      } else {
        const newNode = {
          id: getId(),
          type,
          position,
          data: {
            label: `${labelMap[type]} ${nodeId}`,
            metrics: null,
            ...defaultNodeData[type],
          },
        };

        setNodes((nds) => {
          const nextNodes = nds.concat(newNode);
          if (isRunning && sessionId) {
            syncSimulation(nextNodes, edges);
          }
          return nextNodes;
        });
      }
    },
    [reactFlowInstance, isRunning, sessionId, edges]
  );

  // — Simulation control —
  const startSimulation = async () => {
    const trafficRPS = getTrafficRPS();

    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.data.label,
        maxRPS: n.data.maxRPS || (n.type === 'appserver' ? 100 : n.type === 'database' ? 50 : n.type === 'loadbalancer' ? 500 : 0),
        baseLatency: n.data.baseLatency || (n.type === 'appserver' ? 20 : n.type === 'database' ? 50 : 0),
        isReplica: n.data.isReplica || false,
        backpressureEnabled: n.data.backpressureEnabled || false,
        backpressureThreshold: n.data.backpressureThreshold || 0.9,
        algorithm: n.data.algorithm || 'round-robin',
        readRatio: n.data.readRatio || 0.7,
        concurrencyLimit: n.data.concurrencyLimit || (n.type === 'appserver' ? 100 : n.type === 'database' ? 50 : 0),
        rps: n.data.rps || (n.type === 'client' ? 100 : 0),
      })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
      trafficRPS: trafficRPS,
    };

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setSessionId(data.sessionId);
      setIsRunning(true);

      // Connect WebSocket
      const ws = new WebSocket(`ws://${window.location.hostname}:8080/api/ws/${data.sessionId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const tick = JSON.parse(event.data);
        setTickCount(tick.tick);
        setBottleneckIds(tick.bottleneckIds || []);

        // Update node data with metrics
        setNodes((nds) =>
          nds.map((node) => {
            const metrics = tick.nodes.find((m) => m.id === node.id);
            if (metrics) {
              const updatedData = { ...node.data, metrics };
              return { ...node, data: updatedData };
            }
            return node;
          })
        );

        // Update edge colors based on target node status
        const nodeStatusMap = {};
        tick.nodes.forEach((m) => { nodeStatusMap[m.id] = m.status; });

        setEdges((eds) =>
          eds.map((edge) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            const targetMetrics = tick.nodes.find((m) => m.id === edge.target);
            const targetStatus = targetMetrics?.status;

            let strokeColor = '#6366f1'; // default indigo
            let strokeW = 2;

            // DB Router special treatment
            if (sourceNode?.type === 'dbrouter') {
              if (targetNode?.data?.isReplica) {
                strokeColor = '#22d3ee'; // Cyan (Read)
              } else {
                strokeColor = '#fb923c'; // Orange (Write)
              }
            } else if (targetStatus === 'overloaded') {
              strokeColor = '#f43f5e'; // red
              strokeW = 3;
            } else if (targetStatus === 'stressed') {
              strokeColor = '#f59e0b'; // amber
              strokeW = 2.5;
            }

            return {
              ...edge,
              style: { ...edge.style, stroke: strokeColor, strokeWidth: strokeW },
              animated: true,
            };
          })
        );
      };

      ws.onclose = () => {
        setIsRunning(false);
      };
    } catch (err) {
      console.error('Failed to start simulation:', err);
    }
  };

  const stopSimulation = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/simulate/${sessionId}/stop`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to stop:', err);
      }
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsRunning(false);
    setSessionId(null);
    setBottleneckIds([]);
    setTickCount(0);

    // Reset node metrics
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, metrics: null } })));
    setEdges((eds) =>
      eds.map((e) => ({ ...e, style: { ...e.style, stroke: '#6366f1', strokeWidth: 2 }, animated: true }))
    );
  };

  const toggleSpike = async () => {
    const newSpike = !spikeOn;
    setSpikeOn(newSpike);
    if (isRunning && sessionId) {
      try {
        await fetch(`/api/simulate/${sessionId}/traffic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spike: newSpike }),
        });
      } catch (err) {
        console.error('Failed to toggle spike:', err);
      }
    }
  };

  // Right-click a node to toggle it UP/DOWN (only during simulation)
  const onNodeContextMenu = useCallback(
    async (event, node) => {
      event.preventDefault();
      if (!isRunning || !sessionId) return;

      const newDown = node.data.metrics?.status !== 'down';
      try {
        await fetch(`/api/simulate/${sessionId}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: node.id, down: newDown }),
        });
      } catch (err) {
        console.error('Failed to toggle node:', err);
      }
    },
    [isRunning, sessionId]
  );

  // Toggle node down from properties panel
  const toggleNodeDown = async (nodeId, down) => {
    if (!isRunning || !sessionId) return;
    try {
      await fetch(`/api/simulate/${sessionId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, down }),
      });
    } catch (err) {
      console.error('Failed to toggle node:', err);
    }
  };

  const trafficRPS = getTrafficRPS();

  return (
    <div className="flex h-screen w-full bg-[#0a0a0c] text-slate-200 overflow-hidden font-sans">
      {/* ── Sidebar ── */}
      <div className="w-64 border-r border-white/5 bg-[#0e0e11] flex flex-col p-4 gap-6 shrink-0">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layout className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Arkitect</h1>
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">Drag to Canvas</p>
          <div className="flex flex-col gap-2">
            <DraggableItem icon={<Users className="w-4 h-4" />} label="Client" type="client" color="emerald" />
            <DraggableItem icon={<Share2 className="w-4 h-4" />} label="Load Balancer" type="loadbalancer" color="blue" />
            <DraggableItem icon={<Server className="w-4 h-4" />} label="App Server" type="appserver" color="indigo" />
            <DraggableItem icon={<Split className="w-4 h-4" />} label="DB Router" type="dbrouter" color="violet" />
            <DraggableItem icon={<Database className="w-4 h-4" />} label="Database" type="database" color="rose" />
          </div>
        </div>

        {/* Traffic Controls */}
        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-sm font-medium">Traffic RPS</span>
            <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md">{trafficRPS}</span>
          </div>
          <p className="text-[10px] text-slate-600 px-2 mb-3">Set via Client node properties</p>

          <button
            onClick={toggleSpike}
            className={`mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
              spikeOn
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {spikeOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            {spikeOn ? 'Spike Active (2x)' : 'Traffic Spike'}
          </button>

          <p className="text-[10px] text-slate-600 px-2 mt-4">Right-click a node during simulation to take it DOWN</p>
        </div>
      </div>

      {/* ── Main Canvas ── */}
      <div className="flex-1 relative flex flex-col" ref={reactFlowWrapper}>
        {/* Header Toolbar */}
        <div className="h-14 border-b border-white/5 bg-[#0e0e11]/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={isRunning ? stopSimulation : startSimulation}
              disabled={nodes.length === 0}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                isRunning
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                  : nodes.length === 0
                  ? 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
            >
              {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              {isRunning ? 'Stop' : 'Simulate'}
            </button>

            <div className="h-6 w-px bg-white/10" />

            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Activity className="w-4 h-4" />
              {isRunning ? (
                <span className="text-emerald-400">
                  Tick #{tickCount} · {trafficRPS} rps{spikeOn ? ' (2x spike!)' : ''}
                </span>
              ) : (
                <span className="text-slate-500">Idle</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {bottleneckIds.length > 0 && (
              <div className="flex items-center gap-2 text-xs bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg border border-rose-500/20">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Bottleneck: {bottleneckIds.join(', ')}
              </div>
            )}
            <button
              onClick={clearAll}
              disabled={isRunning || nodes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionMode="loose"
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            className="bg-[#0a0a0c]"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e1e24" gap={24} size={1} />
            <Controls className="!bg-[#141417] !border-white/10 !text-slate-400 !rounded-xl !shadow-2xl" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'client') return '#10b981';
                if (n.type === 'loadbalancer') return '#3b82f6';
                if (n.type === 'appserver') return '#6366f1';
                if (n.type === 'database') return '#f43f5e';
                return '#64748b';
              }}
              maskColor="rgba(0,0,0,0.7)"
              className="!bg-[#141417] !border-white/10 !rounded-xl"
            />
          </ReactFlow>
        </div>
      </div>

      {/* ── Properties Panel ── */}
      {selectedNode && (
        <PropertiesPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={updateNodeData}
          isRunning={isRunning}
          onToggleDown={toggleNodeDown}
          sessionId={sessionId}
          onAddReplica={addReplica}
          onRemoveNode={removeNode}
          onResetQueues={resetQueues}
        />
      )}
    </div>
  );
}

// Draggable sidebar item
function DraggableItem({ icon, label, type, color }) {
  const colorMap = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  };

  const onDragStart = (event) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-white/20 hover:bg-white/5 cursor-grab active:cursor-grabbing transition-all group"
      onDragStart={onDragStart}
      draggable
    >
      <div className={`p-2 rounded-lg ${colorMap[color]} group-hover:scale-110 transition-transform`}>{icon}</div>
      <span className="text-sm font-medium text-slate-300">{label}</span>
    </div>
  );
}

export default App;
