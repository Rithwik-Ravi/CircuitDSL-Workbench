import React, { useMemo } from 'react';
const NODE_WIDTH = 85;
const NODE_HEIGHT = 40;
const PADDING = 48;
export function SchematicCanvas({
  graph,
  computedSignals,
  zoomLevel = 1,
  panOffset = { x: 0, y: 0 },
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
}) {
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const bounds = useMemo(() => {
    if (!nodes.length) {
      return { x: 0, y: 0, width: 720, height: 480 };
    }
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxX = Math.max(...nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT));
    return {
      x: minX - PADDING,
      y: minY - PADDING,
      width: Math.max(300, maxX - minX + PADDING * 2),
      height: Math.max(220, maxY - minY + PADDING * 2),
    };
  }, [nodes]);
  return (
    <div
      className="flex-1 min-w-0 min-h-0 relative overflow-hidden bg-[#1c1917] cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        className="absolute inset-0 block w-full h-full"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Circuit schematic visualizer"
      >
        <defs>
          <pattern
            id="circuit-grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#44403c"
              strokeWidth="0.5"
              opacity="0.35"
            />
          </pattern>
        </defs>
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          rx="14"
          fill="#292524"
          fillOpacity="0.4"
          stroke="#44403c"
        />
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          rx="14"
          fill="url(#circuit-grid)"
        />
        <g
          transform={`translate(${panOffset.x || 0} ${panOffset.y || 0}) scale(${zoomLevel || 1})`}
        >
          {edges.map((edge, index) => {
            const source = nodes.find((node) => node.id === edge.source);
            const target = nodes.find((node) => node.id === edge.target);
            if (!source || !target) return null;
            const sx = source.x + NODE_WIDTH;
            const sy = source.y + NODE_HEIGHT / 2;
            const tx = target.x;
            const ty = target.y + NODE_HEIGHT / 2;
            const dx = Math.max(24, Math.abs(tx - sx) * 0.45);
            const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
            const isHigh = (computedSignals?.[edge.signal] ?? 0) === 1;
            return (
              <g key={edge.id ?? `${edge.source}-${edge.target}-${index}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={isHigh ? '#10b981' : '#57534e'}
                  strokeWidth={isHigh ? 2.5 : 1.5}
                  strokeLinecap="round"
                />
                {isHigh && (
                  <circle r="3" fill="#10b981">
                    <animateMotion
                      path={path}
                      dur="1.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}
          {nodes.map((node) => {
            const isHigh = (computedSignals?.[node.label] ?? 0) === 1;
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="10"
                  fill="#292524"
                  stroke={isHigh ? '#10b981' : '#57534e'}
                  strokeWidth="1.5"
                />
                <text
                  x={NODE_WIDTH / 2}
                  y="14"
                  textAnchor="middle"
                  fill="#a8a29e"
                  fontSize="9"
                  fontWeight="600"
                >
                  {node.gateType}
                </text>
                <text
                  x={NODE_WIDTH / 2}
                  y="29"
                  textAnchor="middle"
                  fill={isHigh ? '#10b981' : '#fefae0'}
                  fontSize="11"
                  fontWeight="600"
                >
                  {node.label}
                </text>
                <circle
                  cx="75"
                  cy="10"
                  r="4"
                  fill={isHigh ? '#10b981' : '#57534e'}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
