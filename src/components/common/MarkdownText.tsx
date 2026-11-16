import * as React from 'react';

/** Safe, dependency-free markdown-lite renderer (headings, bullet lists, **bold**, *italic*). */
export function MarkdownText({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="space-y-3 text-slate-700 leading-relaxed">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('## ')) {
          const lines = trimmed.split('\n');
          return (
            <div key={bi} className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">{renderInline(lines[0].slice(3))}</h3>
              {lines.slice(1).map((line, li) => (
                <p key={li}>{renderInline(line)}</p>
              ))}
            </div>
          );
        }
        const lines = trimmed.split('\n');
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={bi} className="space-y-1.5 pl-5 list-disc">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <div key={bi} className="space-y-1.5">
            {lines.map((line, li) =>
              line.trim().startsWith('- ') ? (
                <div key={li} className="flex gap-2 pl-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>{renderInline(line.trim().slice(2))}</span>
                </div>
              ) : (
                <p key={li}>{renderInline(line)}</p>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderInline(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) parts.push(line.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={k++} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <em key={k++} className="italic text-indigo-700 font-medium">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}
