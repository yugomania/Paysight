"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, type ReactNode } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  ArrowRight,
  X,
  AlertCircle,
  RefreshCw,
  Wrench,
  CheckCircle2,
} from "lucide-react";

const SUGGESTED_PROMPTS = [
  "Summarise my payments for the last 30 days.",
  "How am I pacing against my monthly budget and sales target?",
  "Compare Ergonomic Mechanical Keyboard pricing against competitors.",
  "Show failed or pending transactions.",
  "Help me prepare a draft invoice for a customer.",
];

interface ChatPanelProps {
  onClose?: () => void;
  prefillPrompt?: string;
  onClearPrefill?: () => void;
  onDataMutated?: () => void;
}

// ─── Safe Inline & Block Markdown Renderer (No dangerouslySetInnerHTML) ─────

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      return (
        <strong key={i} className="font-semibold text-[#171717]">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      return (
        <code
          key={i}
          className="px-1 py-0.2 rounded bg-white border border-[#E5E5E5] font-mono text-[11px] text-[#171717]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = tok.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#C2410C] underline hover:text-[#9A3412]"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={i}>{tok}</span>;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (!trimmed) {
      idx += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push(<hr key={idx} className="my-2 border-[#E5E5E5]" />);
      idx += 1;
      continue;
    }

    // Markdown table block
    if (trimmed.startsWith("|") && idx + 1 < lines.length && lines[idx + 1].trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (idx < lines.length && lines[idx].trim().startsWith("|")) {
        tableLines.push(lines[idx].trim());
        idx += 1;
      }
      const parseCells = (row: string) =>
        row
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());

      const headers = parseCells(tableLines[0]);
      const dataRows = tableLines.slice(2).map(parseCells);

      blocks.push(
        <div key={`tbl-${idx}`} className="overflow-x-auto my-2 border border-[#E5E5E5] rounded-lg bg-white">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-[#F7F7F8] border-b border-[#E5E5E5]">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-2 py-1.5 font-semibold text-[#626262]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {dataRows.map((cells, rIdx) => (
                <tr key={rIdx}>
                  {cells.map((c, cIdx) => (
                    <td key={cIdx} className="px-2 py-1.5 text-[#171717]">
                      {renderInlineMarkdown(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (hMatch) {
      blocks.push(
        <div key={idx} className="font-bold text-[#171717] text-[13px] pt-1">
          {renderInlineMarkdown(hMatch[2])}
        </div>
      );
      idx += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      blocks.push(
        <div
          key={idx}
          className="border-l-2 border-[#C2410C] pl-2.5 py-0.5 text-[11px] text-[#626262]"
        >
          {renderInlineMarkdown(trimmed.slice(1).trim())}
        </div>
      );
      idx += 1;
      continue;
    }

    // Bullet / numbered list group
    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const listItems: string[] = [];
      const isOrdered = /^\d+\.\s+/.test(trimmed);
      while (idx < lines.length && /^([-*]|\d+\.)\s+/.test(lines[idx].trim())) {
        listItems.push(lines[idx].trim().replace(/^([-*]|\d+\.)\s+/, ""));
        idx += 1;
      }
      const ListTag = isOrdered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={`list-${idx}`}
          className={`${isOrdered ? "list-decimal" : "list-disc"} list-inside space-y-1 pl-0.5`}
        >
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="text-[#171717]">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    blocks.push(
      <p key={idx} className="text-[#171717]">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
    idx += 1;
  }

  return <div className="space-y-1.5 leading-relaxed">{blocks}</div>;
}

export function ChatPanel({
  onClose,
  prefillPrompt,
  onClearPrefill,
  onDataMutated,
}: ChatPanelProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    error,
    reload,
  } = useChat({
    api: "/api/chat",
    onFinish: (message) => {
      const invokedMutation = message.toolInvocations?.some(
        (t) => t.toolName === "createInvoiceTool" && t.state === "result"
      );
      if (invokedMutation) {
        onDataMutated?.();
      }
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (prefillPrompt && prefillPrompt.trim().length > 0) {
      setInput(prefillPrompt);
      onClearPrefill?.();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [prefillPrompt, setInput, onClearPrefill]);

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white border-l border-[#E5E5E5] flex flex-col h-full overflow-hidden shadow-2xl">
      <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FFF3EB] border border-[#FED7AA] flex items-center justify-center text-[#C2410C]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#171717]">Ask PaySight</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-[#F7F7F8] text-[#171717] border border-[#E5E5E5]">
                Copilot
              </span>
            </div>
            <p className="text-xs text-[#626262]">
              Grounded PayPal, Budget &amp; Channel3 tools
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#ECFDF3] border border-[#BBF7D0] text-[10px] text-[#15803D] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
            <span>Grounded</span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#626262] hover:text-[#171717] hover:bg-[#F7F7F8] border border-[#E5E5E5] transition-colors focus:outline-none focus:ring-1 focus:ring-[#C2410C]"
              aria-label="Close assistant"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0 bg-white">
        {messages.length === 0 ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 bg-[#FFF3EB] border border-[#FED7AA] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[#C2410C]">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-xl rounded-tl-sm p-3.5 text-xs text-[#171717] leading-relaxed break-words">
                Welcome to <strong>PaySight Copilot</strong>. All figures come strictly from
                server-side PayPal ledger, Budget Intelligence, and Channel3 tools.
                <div className="mt-2 text-[#626262]">
                  Invoices always require your exact confirmation before creation or sending.
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-semibold text-[#626262] px-1 uppercase tracking-wider">
                Suggested Prompts
              </div>
              <div className="flex flex-col gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSuggestion(prompt)}
                    className="group text-left text-xs bg-white hover:bg-[#FFF3EB] text-[#171717] px-3 py-2 rounded-lg transition-colors border border-[#E5E5E5] hover:border-[#FED7AA] flex items-center justify-between"
                  >
                    <span className="truncate pr-2">{prompt}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#626262] group-hover:text-[#C2410C] transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  msg.role === "user"
                    ? "bg-[#111111] text-white"
                    : "bg-[#FFF3EB] border border-[#FED7AA] text-[#C2410C]"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
              </div>

              <div
                className={`p-3.5 rounded-xl text-xs max-w-[85%] break-words space-y-2 ${
                  msg.role === "user"
                    ? "bg-[#FFF3EB] border border-[#FED7AA] text-[#171717] rounded-tr-sm font-medium whitespace-pre-wrap"
                    : "bg-[#F7F7F8] border border-[#E5E5E5] text-[#171717] rounded-tl-sm"
                }`}
              >
                {msg.toolInvocations && msg.toolInvocations.length > 0 && (
                  <div className="flex flex-wrap gap-1 pb-1 border-b border-[#E5E5E5]">
                    {msg.toolInvocations.map((inv) => (
                      <span
                        key={inv.toolCallId}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-[#E5E5E5] text-[10px] font-mono text-[#626262]"
                      >
                        {inv.state === "result" ? (
                          <CheckCircle2 className="w-2.5 h-2.5 text-[#15803D]" />
                        ) : (
                          <Wrench className="w-2.5 h-2.5 text-[#C2410C] animate-pulse" />
                        )}
                        <span>{inv.toolName}</span>
                      </span>
                    ))}
                  </div>
                )}

                {msg.role === "user" ? (
                  msg.content
                ) : msg.content ? (
                  <MarkdownContent content={msg.content} />
                ) : (
                  <span className="text-[#626262] italic">Running backend tools…</span>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 bg-[#FFF3EB] border border-[#FED7AA] rounded-full flex items-center justify-center flex-shrink-0 text-[#C2410C]">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-[#C2410C] animate-spin" />
              <span className="text-xs text-[#626262]">
                Querying PayPal, Budget &amp; Channel3 tools…
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 bg-[#FEF2F2] border border-[#FCA5A5] rounded-full flex items-center justify-center flex-shrink-0 text-[#DC2626]">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl rounded-tl-sm p-3.5 text-xs text-[#991B1B] max-w-[85%] space-y-2">
              <div className="font-semibold">Unable to complete request</div>
              <p className="leading-relaxed text-[#7F1D1D]">
                {error.message || "Something went wrong while connecting to the assistant."}
              </p>
              <button
                type="button"
                onClick={() => reload()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Try again</span>
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-[#E5E5E5] bg-white flex gap-2 flex-shrink-0"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about payments, budget, invoices or pricing…"
          aria-label="Ask PaySight Copilot"
          disabled={isLoading}
          className="flex-1 bg-white border border-[#E5E5E5] text-[#171717] text-xs rounded-lg px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#FFF3EB] focus:border-[#C2410C] placeholder:text-[#626262] disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="bg-[#C2410C] hover:bg-[#9A3412] disabled:opacity-40 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
