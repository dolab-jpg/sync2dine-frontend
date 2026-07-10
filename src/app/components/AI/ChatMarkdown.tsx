interface ChatMarkdownProps {
  content: string;
  className?: string;
}

function parseTable(lines: string[]): string[][] | null {
  if (lines.length < 2) return null;
  const header = lines[0].split('|').map((c) => c.trim()).filter(Boolean);
  if (header.length < 2) return null;
  const sep = lines[1];
  if (!/^\|?[\s\-:|]+\|?$/.test(sep)) return null;
  const rows = lines.slice(2).map((line) =>
    line.split('|').map((c) => c.trim()).filter(Boolean)
  ).filter((r) => r.length > 0);
  return [header, ...rows];
}

export function ChatMarkdown({ content, className = '' }: ChatMarkdownProps) {
  const blocks = content.split(/\n\n+/);

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const table = lines[0]?.includes('|') ? parseTable(lines) : null;
        if (table) {
          const [header, ...rows] = table;
          return (
            <div key={bi} className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-slate-200 rounded">
                <thead>
                  <tr className="bg-slate-100">
                    {header.map((cell, ci) => (
                      <th key={ci} className="border border-slate-200 px-2 py-1 text-left font-medium">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="border border-slate-200 px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (lines.every((l) => /^[\s]*[-*•]\s/.test(l) || l.trim() === '')) {
          return (
            <ul key={bi} className="list-disc pl-4 space-y-0.5 text-sm">
              {lines.filter((l) => l.trim()).map((line, li) => (
                <li key={li}>{line.replace(/^[\s]*[-*•]\s+/, '')}</li>
              ))}
            </ul>
          );
        }

        const html = block
          .split('\n')
          .map((line) =>
            line
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.+?)\*/g, '<em>$1</em>')
          )
          .join('<br />');

        return (
          <div
            key={bi}
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
