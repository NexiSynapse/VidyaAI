import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export const TOPIC_NODES = [
  { id: "ds",  label: "Data Structures",   mastery: 82, x: 110, y: 90,  subtopics: ["BST", "Heaps", "Hash Tables", "Tries"] },
  { id: "alg", label: "Algorithms",        mastery: 64, x: 310, y: 75,  subtopics: ["Sorting", "DP", "Graphs", "Greedy"] },
  { id: "os",  label: "Operating Systems", mastery: 31, x: 95,  y: 210, subtopics: ["Memory", "Scheduling", "IPC"] },
  { id: "net", label: "Networks",          mastery: 55, x: 265, y: 195, subtopics: ["TCP/IP", "DNS", "HTTP", "TLS"] },
  { id: "db",  label: "Databases",         mastery: 0,  x: 415, y: 195, subtopics: ["SQL", "Indexing", "Transactions"] },
];

export const TOPIC_EDGES = [
  ["ds", "alg"], ["alg", "os"], ["alg", "net"], ["net", "db"], ["ds", "db"], ["os", "net"],
];

function nodeColor(mastery: number) {
  if (mastery >= 75) return { stroke: "#22c55e", fill: "#14532d", text: "#4ade80", glow: "shadow-[0_0_15px_rgba(34,197,94,0.3)]" };
  if (mastery >= 50) return { stroke: "#6366f1", fill: "#312e81", text: "#818cf8", glow: "shadow-[0_0_15px_rgba(99,102,241,0.3)]" };
  if (mastery >= 30) return { stroke: "#f59e0b", fill: "#78350f", text: "#fbbf24", glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]" };
  if (mastery > 0) return { stroke: "#ef4444", fill: "#7f1d1d", text: "#f87171", glow: "shadow-[0_0_15px_rgba(239,68,68,0.3)]" };
  return { stroke: "#3f3f46", fill: "#27272a", text: "#a1a1aa", glow: "" };
}

export function TopicGraph({ onSelect }: { onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  
  // Simulation state
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    // 1. Prepare nodes
    const simNodes: any[] = [];
    TOPIC_NODES.forEach(n => {
      simNodes.push({
        id: n.id,
        isMain: true,
        label: n.label,
        mastery: n.mastery,
        x: n.x, y: n.y,
        fx: n.x, fy: n.y,
        r: 30,
        subtopics: n.subtopics
      });
      n.subtopics.forEach((st, i) => {
        simNodes.push({
          id: `${n.id}-${st}`,
          isMain: false,
          label: st,
          parentId: n.id,
          parentMastery: n.mastery,
          x: n.x + Math.cos(i) * 50,
          y: n.y + Math.sin(i) * 50,
          r: 20,
        });
      });
    });

    // 2. Prepare links
    const simLinks: any[] = [];
    TOPIC_EDGES.forEach(([source, target]) => {
      simLinks.push({ source, target, isMain: true });
    });
    simNodes.filter(n => !n.isMain).forEach(st => {
      simLinks.push({ source: st.parentId, target: st.id, isMain: false });
    });

    // 3. Setup force simulation
    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance((l: any) => l.isMain ? 150 : 60))
      .force("charge", d3.forceManyBody().strength((d: any) => d.isMain ? -300 : -100))
      .force("collide", d3.forceCollide().radius((d: any) => d.r + 15).iterations(2))
      .on("tick", () => {
        setNodes([...simNodes]);
        setLinks([...simLinks]);
      });

    // 4. Setup Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (e) => {
        setTransform(e.transform);
      });
    d3.select(svgRef.current).call(zoom);

    return () => {
      simulation.stop();
      d3.select(svgRef.current).on(".zoom", null);
    };
  }, []);

  function handleClick(id: string) {
    setSelected(id === selected ? null : id);
    onSelect(id);
  }

  // Draw graph
  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-transparent rounded-2xl">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <pattern id="dots" x={transform.x % 32} y={transform.y % 32} width="32" height="32" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1" fill="#27272a" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#dots)" />

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {/* Main Edges */}
          {links.filter(l => l.isMain).map((l, i) => {
            const isHighlighted = hovered === l.source.id || hovered === l.target.id || selected === l.source.id || selected === l.target.id;
            const bothActive = l.source.mastery > 0 && l.target.mastery > 0;
            return (
              <line
                key={`main-${i}`}
                x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
                stroke={isHighlighted && bothActive ? "#6366f1" : "#2d2d30"}
                strokeWidth={isHighlighted && bothActive ? 2 : 1}
                strokeDasharray={bothActive ? "none" : "4 4"}
                style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
              />
            );
          })}

          {/* Subtopic Edges */}
          {links.filter(l => !l.isMain).map((l, i) => {
            const parentHov = hovered === l.source.id;
            const parentSel = selected === l.source.id;
            if (!parentHov && !parentSel) return null;
            const c = nodeColor(l.source.mastery);
            return (
              <line
                key={`sub-${i}`}
                x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
                stroke={c.stroke} strokeWidth="1" opacity="0.4"
              />
            );
          })}

          {/* Subtopics Nodes */}
          {nodes.filter(n => !n.isMain).map(n => {
            const parentHov = hovered === n.parentId;
            const parentSel = selected === n.parentId;
            if (!parentHov && !parentSel) return null;
            const c = nodeColor(n.parentMastery);
            return (
              <g key={n.id}>
                <rect
                  x={n.x - 30} y={n.y - 10}
                  width="60" height="20" rx="4"
                  fill="#18181b" stroke={c.stroke} strokeWidth="1" opacity="0.9"
                />
                <text
                  x={n.x} y={n.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={c.text} fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {n.label}
                </text>
              </g>
            );
          })}

          {/* Main Nodes */}
          {nodes.filter(n => n.isMain).map(node => {
            const c = nodeColor(node.mastery);
            const isHov = hovered === node.id;
            const isSel = selected === node.id;
            const r = isSel ? 36 : isHov ? 34 : 30;
            const circ = 2 * Math.PI * (r - 6);
            const filled = circ * (node.mastery / 100);
            const empty = circ - filled;

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleClick(node.id)}
              >
                {node.mastery > 0 && (
                  <circle
                    cx={node.x} cy={node.y} r={r + 6}
                    fill="none"
                    stroke={c.stroke}
                    strokeWidth="1"
                    opacity={isHov || isSel ? 0.5 : 0.15}
                    style={{ transition: "opacity 0.2s, r 0.2s" }}
                  />
                )}

                {node.mastery > 0 && (
                  <circle
                    cx={node.x} cy={node.y} r={r - 6}
                    fill="none"
                    stroke={c.stroke}
                    strokeWidth="4"
                    strokeDasharray={`${filled} ${empty}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${node.x} ${node.y})`}
                    opacity={0.8}
                    className={c.glow}
                    style={{ transition: "r 0.2s" }}
                  />
                )}

                <circle
                  cx={node.x} cy={node.y} r={r - 8}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={isSel ? 2 : 1.5}
                  style={{ transition: "r 0.2s" }}
                />

                <text
                  x={node.x} y={node.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={c.text}
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                >
                  {node.mastery > 0 ? `${node.mastery}` : "—"}
                </text>

                <text
                  x={node.x} y={node.y + r + 14}
                  textAnchor="middle"
                  fill={isHov || isSel ? "#f4f4f5" : "#71717a"}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="500"
                  style={{ transition: "fill 0.15s" }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      
      {/* Legend overlay */}
      <div className="absolute top-4 right-4 text-right pointer-events-none">
        <div className="font-mono text-[10px] text-[#a1a1aa] bg-[#18181b]/80 p-2 rounded-lg border border-[#3f3f46]/50 max-w-[160px] text-right ml-auto">
          Connecting lines indicate prerequisites or related topics. You can drag and zoom the map.
        </div>
      </div>
      
      {/* Legend bottom left */}
      <div className="absolute bottom-3 left-3 flex gap-4 pointer-events-none">
        {[
          { label: "Mastered 75+", color: "#22c55e" },
          { label: "Learning 50+", color: "#6366f1" },
          { label: "Weak <50", color: "#f59e0b" },
          { label: "Not started", color: "#52525b" }
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="font-mono text-[9px] text-[#71717a]">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
