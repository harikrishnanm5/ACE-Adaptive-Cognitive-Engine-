import React, { useEffect, useRef, useState } from 'react';

// Sanitize common Mermaid syntax issues that LLMs produce
function sanitizeMermaidSyntax(raw: string): string {
  let chart = raw
    .replace(/```mermaid/g, '')
    .replace(/```/g, '')
    .trim();

  // Fix -->|label|> to -->|label|
  chart = chart.replace(/-->\|([^|]*)\|>/g, '-->|$1|');
  // Fix ---|label|> to ---|label|
  chart = chart.replace(/---\|([^|]*)\|>/g, '---|$1|');
  // Fix ==>|label|> to ==>|label|
  chart = chart.replace(/==>\|([^|]*)\|>/g, '==>|$1|');
  // Remove any stray semicolons at end of lines (not always needed but safer)
  chart = chart.replace(/;\s*$/gm, '');
  // Ensure the first line is a valid graph declaration
  if (!chart.match(/^(graph|flowchart|mindmap|classDiagram|sequenceDiagram|stateDiagram|erDiagram|gantt|pie|journey)/)) {
    chart = 'graph TD\n' + chart;
  }

  return chart;
}

export const MermaidViewer = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref.current || !chart) return;
    setLoading(true);

    const cleanChart = sanitizeMermaidSyntax(chart);

    import('mermaid').then((mermaidModule) => {
      const mermaid = mermaidModule.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'Inter, sans-serif',
        themeVariables: {
          primaryColor: '#6366f1',
          primaryTextColor: '#e2e8f0',
          primaryBorderColor: '#4f46e5',
          lineColor: '#6366f1',
          secondaryColor: '#1e293b',
          tertiaryColor: '#0f172a',
        }
      });

      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      mermaid.render(id, cleanChart)
        .then((result) => {
          if (ref.current) {
            ref.current.innerHTML = result.svg;
            setError(null);
          }
        })
        .catch((e) => {
          console.error("Mermaid render error:", e);
          setError("Could not render diagram. Raw syntax shown below.");
        })
        .finally(() => setLoading(false));
    }).catch(() => {
      setError("Mermaid library not installed. Run: npm install mermaid");
      setLoading(false);
    });
  }, [chart]);

  return (
    <div className="w-full bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header bar */}
      <div className="w-full bg-slate-800/50 px-6 py-3 border-b border-white/5 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500/50" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
        <span className="ml-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Interactive Mind Map</span>
      </div>

      {loading && !error && (
        <div className="p-12 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {error ? (
        <div className="p-8 space-y-4">
          <p className="text-red-400 text-sm font-bold">{error}</p>
          <pre className="text-slate-400 text-xs font-mono bg-slate-800 p-6 rounded-2xl overflow-x-auto border border-white/5 whitespace-pre-wrap">
            {chart.replace(/```mermaid/g, '').replace(/```/g, '').trim()}
          </pre>
        </div>
      ) : (
        <div
          ref={ref}
          className="w-full p-8 overflow-x-auto flex justify-center items-center min-h-[300px]"
        />
      )}
    </div>
  );
};
