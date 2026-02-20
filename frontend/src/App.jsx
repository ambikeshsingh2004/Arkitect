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

import { Layout, Play, Square, Activity, Database, Server, Share2, Users, Zap, ZapOff, Trash2 } from 'lucide-react';

import LoadBalancerNode from './components/nodes/LoadBalancerNode.jsx';
import AppServerNode from './components/nodes/AppServerNode.jsx';
import DatabaseNode from './components/nodes/DatabaseNode.jsx';
import ClientNode from './components/nodes/ClientNode.jsx';
import PropertiesPanel from './components/PropertiesPanel.jsx';

const nodeTypes = {
  client: ClientNode,
  loadbalancer: LoadBalancerNode,
  appserver: AppServerNode,
  database: DatabaseNode,
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
  client: { rps: 100 },
  loadbalancer: { algorithm: 'round-robin' },
  appserver: { maxRPS: 100, baseLatency: 20 },
  database: { maxRPS: 50, baseLatency: 50 },
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

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((connection) => setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds)), []);

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

  // Clear all
  const clearAll = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
  };

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
      };

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

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance]
  );

  // — Simulation control —
  const startSimulation = async () => {
    const trafficRPS = getTrafficRPS();

    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.data.label,
        maxRPS: n.data.maxRPS || (n.type === 'appserver' ? 100 : n.type === 'database' ? 50 : 0),
        baseLatency: n.data.baseLatency || (n.type === 'appserver' ? 20 : n.type === 'database' ? 50 : 0),
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
            if (node.type === 'client') {
              // Sync client RPS from backend's actual traffic value
              return {
                ...node,
                data: {
                  ...node.data,
                  rps: tick.totalRPS || node.data.rps || 100,
                  metrics: { throughput: tick.totalRPS || node.data.rps || 100 },
                },
              };
            }
            const metrics = tick.nodes.find((m) => m.id === node.id);
            if (metrics) {
              return {
                ...node,
                data: { ...node.data, metrics },
              };
            }
            return node;
          })
        );

        // Update edge colors based on target node status
        const nodeStatusMap = {};
        tick.nodes.forEach((m) => { nodeStatusMap[m.id] = m.status; });

        setEdges((eds) =>
          eds.map((edge) => {
            const targetStatus = nodeStatusMap[edge.target];
            let strokeColor = '#6366f1'; // default indigo
            let strokeW = 2;

            if (targetStatus === 'overloaded') {
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
