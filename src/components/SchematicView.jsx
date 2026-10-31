import React, { useMemo, useState, useRef, useEffect } from 'react';
import dagre from 'dagre';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Filter, Activity } from 'lucide-react';

export function SchematicView({
  graph,
  signals = {},
  onToggleInput,
  activeChange, // For Optimizer Time Machine highlighting
  selectedSignal,
  onSelectSignal,
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Compute Dagre layered layout
  const layout = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return { nodes: [], edges: [], width: 800, height: 600 };
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'LR',
      align: 'UL',
      nodesep: 45,
      ranksep: 90,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Register nodes with proper dimensions
    graph.nodes.forEach((node) => {
      let width = 90;
      let height = 50;
      if (node.type === 'input' || node.type === 'output') {
        width = 80;
        height = 36;
      } else if (node.gateType === 'DFF') {
        width = 90;
        height = 70;
      } else if (node.type === 'const') {
        width = 40;
        height = 30;
      }
      g.setNode(node.id, { ...node, width, height });
    });

    // Register edges
    graph.edges.forEach((edge) => {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target, { ...edge });
      }
    });

    dagre.layout(g);

    const layoutNodes = g.nodes().map((nodeId) => {
      const n = g.node(nodeId);
      return {
        ...n,
        x: n.x,
        y: n.y,
      };
    });

    const layoutEdges = g.edges().map((e) => {
      const edgeData = g.edge(e);
      return {
        id: `${e.v}_to_${e.w}`,
        source: e.v,
        target: e.w,
        points: edgeData.points || [],
        signal: edgeData.signal,
      };
    });

    const gInfo = g.graph();
    return {
      nodes: layoutNodes,
      edges: layoutEdges,
      width: (gInfo.width || 800) + 100,
      height: (gInfo.height || 600) + 100,
    };
  }, [graph]);

  // Compute Signal Tracing (fan-in cone and fan-out cone)
  const tracing = useMemo(() => {
    if (!selectedSignal || !graph) return { fanIn: new Set(), fanOut: new Set() };

    const fanIn = new Set();
    const fanOut = new Set();

    // Find node matching selected signal
    const startNode = graph.nodes.find(
      (n) => n.label === selectedSignal || n.id === `gate_${selectedSignal}` || n.id === `in_${selectedSignal}`
    );

    if (!startNode) return { fanIn, fanOut };

    // Traverse fan-in (upstream)
    const inQueue = [startNode.id];
    fanIn.add(startNode.id);
    while (inQueue.length > 0) {
      const curr = inQueue.shift();
      graph.edges.forEach((e) => {
        if (e.target === curr && !fanIn.has(e.source)) {
          fanIn.add(e.source);
          inQueue.push(e.source);
        }
      });
    }

    // Traverse fan-out (downstream)
    const outQueue = [startNode.id];
    fanOut.add(startNode.id);
    while (outQueue.length > 0) {
      const curr = outQueue.shift();
      graph.edges.forEach((e) => {
        if (e.source === curr && !fanOut.has(e.target)) {
          fanOut.add(e.target);
          outQueue.push(e.target);
        }
      });
    }

    return { fanIn, fanOut };
  }, [selectedSignal, graph]);

  // Fit to view
  const fitToView = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const scaleX = (clientWidth - 80) / layout.width;
    const scaleY = (clientHeight - 80) / layout.height;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.8);
    setZoom(newZoom);
    setPan({
      x: (clientWidth - layout.width * newZoom) / 2,
      y: (clientHeight - layout.height * newZoom) / 2,
    });
  };

  useEffect(() => {
    fitToView();
  }, [layout.width, layout.height]);

  // Pan interaction
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(Math.max(z * zoomFactor, 0.2), 3));
  };

  // Render SVG Gate Symbol
  const renderGateSymbol = (node) => {
    const isHigh = signals[node.label] === 1;
    const isSelected = selectedSignal === node.label;
    const isFanIn = tracing.fanIn.has(node.id);
    const isFanOut = tracing.fanOut.has(node.id);

    // Time machine highlights
    let strokeColor = '#78716c';
    let fillColor = '#262423';
    if (activeChange) {
      if (activeChange.target === node.label) {
        if (activeChange.pass === 'DCE') strokeColor = '#ef4444'; // red
        else if (activeChange.pass === 'CSE') strokeColor = '#f59e0b'; // amber
        else strokeColor = '#3b82f6'; // blue
      }
    } else if (isSelected) {
      strokeColor = '#f59e0b';
      fillColor = '#3b2816';
    } else if (isFanIn) {
      strokeColor = '#60a5fa'; // blue
    } else if (isFanOut) {
      strokeColor = '#a855f7'; // purple
    } else if (isHigh) {
      strokeColor = '#10b981'; // green
    }

    const gate = (node.gateType || '').toUpperCase();

    // 1. INPUT Port Node
    if (node.type === 'input') {
      const val = signals[node.label] ?? 0;
      return (
        <g
          transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
          className="cursor-pointer group"
          onClick={() => {
            if (onToggleInput) onToggleInput(node.label);
            if (onSelectSignal) onSelectSignal(node.label);
          }}
        >
          <rect
            width={node.width}
            height={node.height}
            rx={18}
            fill={val ? '#064e3b' : '#292524'}
            stroke={val ? '#10b981' : '#57534e'}
            strokeWidth={isSelected ? 3 : 1.5}
            className="transition-colors group-hover:stroke-amber-400"
          />
          <text
            x={node.width / 2 - 12}
            y={node.height / 2 + 4}
            textAnchor="middle"
            fill="#e7e5e4"
            fontSize="11"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {node.label}
          </text>
          <circle
            cx={node.width - 16}
            cy={node.height / 2}
            r={8}
            fill={val ? '#10b981' : '#44403c'}
          />
          <text
            x={node.width - 16}
            y={node.height / 2 + 3.5}
            textAnchor="middle"
            fill={val ? '#022c22' : '#d6d3d1'}
            fontSize="10"
            fontWeight="bold"
          >
            {val}
          </text>
        </g>
      );
    }

    // 2. OUTPUT Port Node
    if (node.type === 'output') {
      const val = signals[node.label] ?? 0;
      return (
        <g
          transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
          className="cursor-pointer"
          onClick={() => onSelectSignal && onSelectSignal(node.label)}
        >
          <rect
            width={node.width}
            height={node.height}
            rx={6}
            fill={val ? '#064e3b' : '#292524'}
            stroke={val ? '#10b981' : '#57534e'}
            strokeWidth={isSelected ? 3 : 1.5}
          />
          <text
            x={14}
            y={node.height / 2 + 4}
            fill="#e7e5e4"
            fontSize="11"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {node.label}
          </text>
          <circle
            cx={node.width - 16}
            cy={node.height / 2}
            r={8}
            fill={val ? '#10b981' : '#44403c'}
          />
          <text
            x={node.width - 16}
            y={node.height / 2 + 3.5}
            textAnchor="middle"
            fill={val ? '#022c22' : '#d6d3d1'}
            fontSize="10"
            fontWeight="bold"
          >
            {val}
          </text>
        </g>
      );
    }

    // 3. Constant Node (0 or 1)
    if (node.type === 'const') {
      return (
        <g
          transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
        >
          <rect
            width={node.width}
            height={node.height}
            rx={4}
            fill="#1c1917"
            stroke="#57534e"
            strokeWidth={1}
          />
          <text
            x={node.width / 2}
            y={node.height / 2 + 4}
            textAnchor="middle"
            fill="#a8a29e"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {node.label}
          </text>
        </g>
      );
    }

    // 4. Sequential Element: D Flip-Flop
    if (gate === 'DFF') {
      return (
        <g
          transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
          className="cursor-pointer"
          onClick={() => onSelectSignal && onSelectSignal(node.label)}
        >
          <rect
            width={node.width}
            height={node.height}
            rx={6}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={2}
          />
          {/* Clock Triangle at bottom left pin */}
          <path d="M 6 45 L 16 50 L 6 55 Z" fill="none" stroke="#a8a29e" strokeWidth="1.5" />
          <text x={22} y={53} fill="#a8a29e" fontSize="9" fontWeight="bold">CLK</text>
          <text x={8} y={24} fill="#a8a29e" fontSize="10" fontWeight="bold">D</text>
          <text x={node.width - 18} y={24} fill="#a8a29e" fontSize="10" fontWeight="bold">Q</text>
          <text
            x={node.width / 2}
            y={node.height - 10}
            textAnchor="middle"
            fill="#d6d3d1"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {node.label}
          </text>
        </g>
      );
    }

    // 5. Combinational Gates (AND, OR, XOR, NOT, NAND, NOR, XNOR, BUF)
    const w = node.width;
    const h = node.height;
    return (
      <g
        transform={`translate(${node.x - w / 2}, ${node.y - h / 2})`}
        className="cursor-pointer"
        onClick={() => onSelectSignal && onSelectSignal(node.label)}
      >
        <rect
          width={w}
          height={h}
          rx={8}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 2}
        />
        <text
          x={w / 2}
          y={h / 2 - 2}
          textAnchor="middle"
          fill="#f59e0b"
          fontSize="11"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {gate}
        </text>
        <text
          x={w / 2}
          y={h / 2 + 12}
          textAnchor="middle"
          fill="#a8a29e"
          fontSize="9"
          fontFamily="monospace"
        >
          {node.label}
        </text>
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#181615] select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Background Dot Grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <pattern id="grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#78716c" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-dots)" />
      </svg>

      {/* Main Schematic Diagram Canvas */}
      <svg className="w-full h-full overflow-visible">
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Signal Wires */}
          {layout.edges.map((edge) => {
            const isHigh = signals[edge.signal] === 1;
            const isSelected = selectedSignal === edge.signal;
            const points = edge.points || [];

            let pathD = '';
            if (points.length >= 2) {
              pathD = `M ${points[0].x} ${points[0].y}`;
              for (let i = 1; i < points.length; i++) {
                pathD += ` L ${points[i].x} ${points[i].y}`;
              }
            }

            const strokeColor = isSelected
              ? '#f59e0b'
              : isHigh
              ? '#10b981'
              : '#57534e';

            return (
              <g
                key={edge.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectSignal && edge.signal) onSelectSignal(edge.signal);
                }}
              >
                {/* Thick invisible hit area for easy clicking */}
                <path d={pathD} fill="none" stroke="transparent" strokeWidth="14" />
                {/* Visible Signal Wire */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3 : isHigh ? 2.5 : 1.5}
                  className="transition-colors"
                />
              </g>
            );
          })}

          {/* Logic Gate & Port Nodes */}
          {layout.nodes.map((node) => (
            <g key={node.id}>{renderGateSymbol(node)}</g>
          ))}
        </g>
      </svg>

      {/* Canvas Floating Toolbar */}
      <div className="absolute bottom-4 right-4 flex items-center space-x-1 bg-[#262423]/90 backdrop-blur-md px-2 py-1.5 rounded-xl border border-[#44403c] shadow-lg text-[#d6d3d1]">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
          className="p-1.5 hover:text-amber-400 hover:bg-[#3b3836] rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z / 1.2, 0.2))}
          className="p-1.5 hover:text-amber-400 hover:bg-[#3b3836] rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={fitToView}
          className="p-1.5 hover:text-amber-400 hover:bg-[#3b3836] rounded-lg transition-colors"
          title="Fit to View"
        >
          <Maximize2 size={16} />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 50, y: 50 });
          }}
          className="p-1.5 hover:text-amber-400 hover:bg-[#3b3836] rounded-lg transition-colors"
          title="Reset View"
        >
          <RotateCcw size={16} />
        </button>
        <span className="text-xs font-mono text-[#a8a29e] px-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Signal Tracing Info Card (N4) */}
      {selectedSignal && (
        <div className="absolute top-4 left-4 bg-[#262423]/95 backdrop-blur-md p-3 rounded-xl border border-amber-500/40 shadow-xl max-w-xs text-xs">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#44403c]">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Activity size={14} /> Signal: {selectedSignal}
            </span>
            <button
              onClick={() => onSelectSignal && onSelectSignal(null)}
              className="text-[#a8a29e] hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-[#d6d3d1]">
            <div className="flex justify-between">
              <span className="text-[#a8a29e]">Current Value:</span>
              <span
                className={`font-mono font-bold ${
                  signals[selectedSignal] ? 'text-emerald-400' : 'text-stone-400'
                }`}
              >
                {signals[selectedSignal] ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a8a29e]">Fan-In Nodes:</span>
              <span className="font-mono text-blue-400">{tracing.fanIn.size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a8a29e]">Fan-Out Nodes:</span>
              <span className="font-mono text-purple-400">{tracing.fanOut.size}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
