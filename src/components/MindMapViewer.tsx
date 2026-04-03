import React, { useEffect, useRef } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { motion } from 'motion/react';
import { Maximize2, Download, ZoomIn, ZoomOut, Target } from 'lucide-react';

const transformer = new Transformer();

export const MindMapViewer = ({ content }: { content: string }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (!svgRef.current || !content) return;

    // Clean markdown content (remove mermaid/code blocks/headings tags if any)
    let cleanContent = content
      .replace(/```mermaid|```/gi, '')
      .replace(/^#+\s+/gm, '- ') // Convert headings to list items for better Markmap support
      .trim();
    
    // Ensure it's a valid list if AI failed slightly
    if (!cleanContent.startsWith('-')) {
        cleanContent = cleanContent.split('\n').map(line => line.trim() ? `- ${line}` : '').join('\n');
    }

    const { root } = transformer.transform(cleanContent);

    const initMarkmap = () => {
        if (!svgRef.current) return;
        if (!mmRef.current) {
            mmRef.current = Markmap.create(svgRef.current, {
                autoFit: true,
                paddingX: 32,
                initialExpandLevel: 3,
            }, root);
        } else {
            mmRef.current.setData(root);
            mmRef.current.fit();
        }
    };

    // Small delay to ensure container has dimensions
    const timer = setTimeout(initMarkmap, 100);

    // Resize observer to handle container changes
    const observer = new ResizeObserver(() => {
        mmRef.current?.fit();
    });
    if (svgRef.current.parentElement) observer.observe(svgRef.current.parentElement);

    return () => {
        clearTimeout(timer);
        observer.disconnect();
    };
  }, [content]);

  const handleZoomIn = () => mmRef.current?.rescale(1.2);
  const handleZoomOut = () => mmRef.current?.rescale(0.8);
  const handleFit = () => mmRef.current?.fit();

  return (
    <div className="relative w-full h-[600px] bg-[#0B0D11] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden group">
      {/* Premium Canvas Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.03),transparent)]" />
      
      {/* Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl shadow-xl">
          <button 
            onClick={handleZoomIn}
            className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button 
            onClick={handleFit}
            className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
            title="Fit to Screen"
          >
            <Target className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Status */}
      <div className="absolute bottom-6 left-8 flex items-center gap-3 z-10">
        <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">High-Fidelity Model</span>
        </div>
      </div>

      {/* Mindmap Canvas */}
      <svg 
        ref={svgRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing markmap-premium"
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .markmap-premium {
          font-family: 'Outfit', 'Inter', system-ui, sans-serif;
        }
        .markmap-node {
          cursor: pointer;
        }
        .markmap-node circle {
          fill: #6366f1 !important;
          stroke: #121316 !important;
          stroke-width: 3px !important;
          r: 6px !important;
        }
        .markmap-node text {
          fill: #E2E8F0 !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          paint-order: stroke;
          stroke: #0B0D11;
          stroke-width: 4px;
        }
        .markmap-link {
          stroke: rgba(99, 102, 241, 0.4) !important;
          stroke-width: 2.5px !important;
          transition: stroke 0.3s ease;
        }
        .markmap-link:hover {
            stroke-opacity: 0.8;
            stroke-width: 3.5px !important;
        }
        /* Custom Node Branching Aesthetic */
        .markmap-node-depth-0 text { 
            font-size: 20px !important; 
            font-weight: 900 !important; 
            fill: #ffffff !important;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        .markmap-node-depth-0 > rect {
            fill: rgba(99, 102, 241, 0.15) !important;
            stroke: #6366f1 !important;
            stroke-width: 2px;
            rx: 16px;
            ry: 16px;
        }
        /* Sub-nodes styling */
        .markmap-node-depth-1 text {
            font-size: 15px !important;
            fill: #indigo-300 !important;
            font-weight: 700 !important;
        }
        /* Connection Lines - Sankey/Bezier Curve Style */
        .markmap-link {
            fill: none;
        }
      `}} />
    </div>
  );
};
