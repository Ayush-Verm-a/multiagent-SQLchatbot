import { useState } from "react";
import type { ChatItem } from "../context/context";
import { parseMarkdownTable } from "../utils/markdownTable";
import { CheckIcon, CopyIcon } from "./Icons";

function ResultTable({ markdown }: { markdown: string }) {
    const table = parseMarkdownTable(markdown);
    if (!table) return <pre className="raw-result">{markdown}</pre>;

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

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(sql);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="sql">
            <div className="sql__header">
                <span className="label">SQL</span>
                <button className="sql__copy" onClick={handleCopy}>
                    {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                </button>
            </div>
            <pre><code>{sql}</code></pre>
        </div>
    );
}

function MessageBubble({ chat }: { chat: ChatItem }) {
    if (chat.chatSender === "user") {
        return <div className="msg msg--user">{chat.chatMsg}</div>;
    }

    if (chat.chatSender === "error") {
        return <div className="msg msg--bot notice notice--error">{chat.chatMsg}</div>;
    }

    if (chat.msgType === "greeting_response") {
        return <div className="msg msg--bot msg--plain">{chat.chatMsg}</div>;
    }

    return (
        <div className="msg msg--bot msg--answer">
            {chat.chatMsg && <p className="msg__text">{chat.chatMsg}</p>}
            {chat.queryResult && <ResultTable markdown={chat.queryResult} />}
            {chat.sqlQuery && <SqlBlock sql={chat.sqlQuery} />}
            {chat.error && <p className="notice notice--error">{chat.error}</p>}
        </div>
    );
}

export default MessageBubble;
