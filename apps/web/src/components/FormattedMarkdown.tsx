"use client";

import React from "react";
import { CheckCircle2, ChevronRight, HelpCircle, Table as TableIcon } from "lucide-react";

interface FormattedMarkdownProps {
  content: string;
}

export function FormattedMarkdown({ content }: FormattedMarkdownProps) {
  if (!content) return null;

  // Clean up common concatenated word issues (e.g. "Untuk3" -> "Untuk 3", "recover4leads" -> "recover 4 leads")
  const cleanedContent = content
    .replace(/([a-zA-Z])(\d+)([a-zA-Z])/g, "$1 $2 $3")
    .replace(/([a-zA-Z])(\d+)/g, "$1 $2")
    .replace(/(\d+)([a-zA-Z])/g, "$1 $2");

  const lines = cleanedContent.split("\n");
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];
  let tableKey = 0;

  const flushTable = () => {
    if (inTable && tableHeader.length > 0) {
      elements.push(
        <div key={`table-${tableKey++}`} className="my-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/80 text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200">
              <tr>
                {tableHeader.map((th, i) => (
                  <th key={i} className="px-3.5 py-2.5">
                    {renderInlineFormatting(th.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2.5 font-sans leading-relaxed">
                      {renderInlineFormatting(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    inTable = false;
    tableHeader = [];
    tableRows = [];
  };

  let idx = 0;
  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();

    // Check if table row (starts and ends with | or contains multiple |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // Check if divider row (e.g. |---|---|---|)
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        // Just divider row, skip
        idx++;
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      idx++;
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4);
      elements.push(
        <h4 key={idx} className="mt-4 mb-2 text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
          <span>{renderInlineFormatting(text)}</span>
        </h4>,
      );
    } else if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3);
      elements.push(
        <h3 key={idx} className="mt-5 mb-2 text-sm font-extrabold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-2">
          <span>{renderInlineFormatting(text)}</span>
        </h3>,
      );
    } else if (trimmed.startsWith("# ")) {
      const text = trimmed.slice(2);
      elements.push(
        <h2 key={idx} className="mt-6 mb-3 text-base font-black text-slate-900">
          {renderInlineFormatting(text)}
        </h2>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const text = trimmed.slice(2);
      elements.push(
        <div key={idx} className="ml-3 my-1 flex items-start gap-2 text-xs leading-relaxed text-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
          <div>{renderInlineFormatting(text)}</div>
        </div>,
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (match) {
        const num = match[1];
        const text = match[2];
        elements.push(
          <div key={idx} className="ml-2 my-1.5 flex items-start gap-2 text-xs leading-relaxed text-slate-700">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 flex-shrink-0 mt-0.5">
              {num}
            </span>
            <div>{renderInlineFormatting(text)}</div>
          </div>,
        );
      }
    } else if (trimmed === "```" || trimmed.startsWith("```")) {
      // Collect code block
      const codeLines: string[] = [];
      idx++;
      while (idx < lines.length && !lines[idx].trim().startsWith("```")) {
        codeLines.push(lines[idx]);
        idx++;
      }
      elements.push(
        <div key={idx} className="my-3 rounded-xl bg-slate-900 p-3.5 text-xs text-slate-100 font-mono overflow-x-auto shadow-inner leading-relaxed whitespace-pre">
          {codeLines.join("\n")}
        </div>,
      );
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={idx} className="my-1.5 text-xs leading-relaxed text-slate-700">
          {renderInlineFormatting(trimmed)}
        </p>,
      );
    } else {
      elements.push(<div key={idx} className="h-2" />);
    }

    idx++;
  }

  if (inTable) {
    flushTable();
  }

  return <div className="space-y-1 font-sans">{elements}</div>;
}

/** Helper function to parse bold **text**, *text*, and links */
function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;

  // Split by double asterisks **bold** or single asterisks *bold*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <strong key={i} className="font-semibold text-slate-800">
          {part.slice(1, -1)}
        </strong>
      );
    }
    return part;
  });
}
