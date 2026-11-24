import { useState, type MouseEvent } from "react";
import type { ChatItem } from "../context/context";
import { parseMarkdownTable } from "../utils/markdownTable";
import { humanize, toCsv, type ResultSet } from "../utils/responseParser";
import { CheckIcon, CopyIcon, DownloadIcon } from "./Icons";

interface MessageBubbleProps {
    chat: ChatItem;
    onSuggestion: (question: string) => void;
    suggestionsDisabled: boolean;
}

function isNumericColumn(result: ResultSet, column: string) {
    let seen = false;
    for (const row of result.rows) {
        const value = row[column];
        if (value === null || value === undefined) continue;
        if (typeof value !== "number") return false;
        seen = true;
    }
    return seen;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") {
        if (Number.isInteger(value)) return Math.abs(value) >= 10000 ? value.toLocaleString() : String(value);
        return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function downloadCsv(result: ResultSet) {
    const blob = new Blob([toCsv(result)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.key}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function ResultCard({ result }: { result: ResultSet }) {
    const { columns, rows } = result;
    const singleValue = result.success && rows.length === 1 && columns.length === 1;
    const numeric = new Set(columns.filter((c) => isNumericColumn(result, c)));
    const countLabel = `${result.rowCount.toLocaleString()} ${result.rowCount === 1 ? "row" : "rows"}`;

    return (
        <div className="result">
            <div className="result__header">
                <div className="result__heading">
                    <span className="result__title">{result.title}</span>
                    {result.summary && <span className="result__summary">{result.summary}</span>}
                </div>
                {result.success && rows.length > 0 && !singleValue && (
                    <button className="sql__copy" onClick={() => downloadCsv(result)} title="Download as CSV">
                        <DownloadIcon /> CSV
                    </button>
                )}
            </div>

            {!result.success ? (
                <p className="notice notice--error result__notice">
                    {result.error ?? "This part of the question couldn't be answered."}
                </p>
            ) : rows.length === 0 ? (
                <p className="result__empty">No matching records.</p>
            ) : singleValue ? (
                <div className="result-stat">
                    <b>{formatValue(rows[0][columns[0]])}</b>
                    <span title={columns[0]}>{humanize(columns[0])}</span>
                </div>
            ) : (
                <>
                    <div className="result__scroll">
                        <table>
                            <thead>
                                <tr>
                                    {columns.map((c) => (
                                        <th key={c} title={c} className={numeric.has(c) ? "num" : undefined}>{humanize(c)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, r) => (
                                    <tr key={r}>
                                        {columns.map((c) => {
                                            const value = row[c];
                                            const empty = value === null || value === undefined;
                                            const cls = [numeric.has(c) && "num", empty && "cell--empty"].filter(Boolean).join(" ");
                                            return <td key={c} className={cls || undefined}>{formatValue(value)}</td>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="result__footer">{countLabel}</div>
                </>
            )}
        </div>
    );
}

// query_result text that isn't the expected JSON: older markdown tables, or malformed output
function RawResult({ text }: { text: string }) {
    const table = parseMarkdownTable(text);
    if (!table) return <pre className="raw-result">{text}</pre>;

    return (
        <div className="result">
            <div className="result__scroll">
                <table>
                    <thead>
                        <tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, r) => (
                            <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="result__footer">
                {table.rows.length.toLocaleString()} {table.rows.length === 1 ? "row" : "rows"}
            </div>
        </div>
    );
}

function SqlBlock({ sql }: { sql: string }) {
    const [copied, setCopied] = useState(false);

    async function handleCopy(e: MouseEvent) {
        // The button sits inside <summary>; don't toggle the block
        e.preventDefault();
        try {
            await navigator.clipboard.writeText(sql);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    return (
        <details className="sql">
            <summary className="sql__header">
                <span className="label sql__toggle">SQL query</span>
                <button className="sql__copy" onClick={handleCopy}>
                    {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                </button>
            </summary>
            <pre><code>{sql}</code></pre>
        </details>
    );
}

function Suggestions({ items, onPick, disabled, label }: { items: string[]; onPick: (q: string) => void; disabled: boolean; label?: string }) {
    return (
        <div className="suggestions">
            {label && <span className="label">{label}</span>}
            <div className="suggestions__list">
                {items.map((item) => (
                    <button key={item} className="suggestion" onClick={() => onPick(item)} disabled={disabled}>
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );
}

function MessageBubble({ chat, onSuggestion, suggestionsDisabled }: MessageBubbleProps) {
    if (chat.chatSender === "user") {
        return <div className="msg msg--user">{chat.chatMsg}</div>;
    }

    if (chat.chatSender === "error") {
        return <div className="msg msg--bot notice notice--error">{chat.chatMsg}</div>;
    }

    const suggestions = chat.suggestions ?? [];

    if (chat.msgType === "greeting_response") {
        return (
            <div className="msg msg--bot msg--plain">
                <p>{chat.chatMsg}</p>
                {suggestions.length > 0 && (
                    <Suggestions items={suggestions} onPick={onSuggestion} disabled={suggestionsDisabled} />
                )}
            </div>
        );
    }

    const results = chat.results ?? [];

    return (
        <div className="msg msg--bot msg--answer">
            {chat.chatMsg && <p className="msg__text">{chat.chatMsg}</p>}
            {chat.error && <p className="notice notice--warn">{chat.error}</p>}
            {results.map((result) => <ResultCard key={result.key} result={result} />)}
            {chat.rawResult && <RawResult text={chat.rawResult} />}
            {chat.sqlQuery && <SqlBlock sql={chat.sqlQuery} />}
            {suggestions.length > 0 && (
                <Suggestions items={suggestions} onPick={onSuggestion} disabled={suggestionsDisabled} label="Follow-up questions" />
            )}
        </div>
    );
}

export default MessageBubble;
