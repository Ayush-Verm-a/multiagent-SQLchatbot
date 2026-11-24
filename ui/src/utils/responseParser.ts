// Turns the text sections of a /api/chat response into structured data for display.
// Every parser is defensive: the sections come from an LLM, so any of them can be
// missing or malformed, and the UI falls back to showing the raw text.

export type ResultRow = Record<string, unknown>;

export type ResultSet = {
    // Key from the QUERY_RESULT JSON, e.g. "top_5_products_by_units_sold"
    key: string;
    title: string;
    success: boolean;
    summary?: string;
    error?: string;
    columns: string[];
    rows: ResultRow[];
    rowCount: number;
}

export type ParsedQueryResult = {
    results: ResultSet[];
    // Set when the section is present but isn't the expected JSON
    raw: string | null;
}

const SECTION_MARKER = /<<<[^>]*>>>/;
const LIST_ITEM = /^\s*(?:\d+[.)]|[-*•])\s+(.+?)\s*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripFences(text: string) {
    let out = text.trim();
    if (out.startsWith("```")) {
        const newline = out.indexOf("\n");
        out = newline === -1 ? "" : out.slice(newline + 1);
        if (out.trimEnd().endsWith("```")) out = out.trimEnd().slice(0, -3);
    }
    return out.trim();
}

export function humanize(name: string) {
    const spaced = name.replace(/_+/g, " ").trim();
    return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : name;
}

function looksLikeResult(value: unknown): value is Record<string, unknown> {
    return isRecord(value) && ("data" in value || "columns" in value || "success" in value);
}

function toResultSet(key: string, raw: Record<string, unknown>): ResultSet {
    const rows = Array.isArray(raw.data) ? raw.data.filter(isRecord) : [];
    const columns = Array.isArray(raw.columns) && raw.columns.length > 0
        ? raw.columns.map(String)
        : rows[0] ? Object.keys(rows[0]) : [];

    return {
        key,
        title: humanize(key),
        success: raw.success !== false,
        summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : undefined,
        error: typeof raw.error === "string" && raw.error.trim() ? raw.error.trim() : undefined,
        columns,
        rows,
        rowCount: typeof raw.row_count === "number" ? raw.row_count : rows.length,
    };
}

// QUERY_RESULT is JSON keyed by query name: { name: { success, summary, data, row_count, columns } }
export function parseQueryResult(text: string | null | undefined): ParsedQueryResult {
    const trimmed = text?.trim();
    if (!trimmed) return { results: [], raw: null };

    let parsed: unknown;
    try {
        parsed = JSON.parse(stripFences(trimmed));
    } catch {
        return { results: [], raw: trimmed };
    }

    if (looksLikeResult(parsed)) {
        return { results: [toResultSet("result", parsed)], raw: null };
    }
    if (isRecord(parsed)) {
        const results = Object.entries(parsed)
            .filter((entry): entry is [string, Record<string, unknown>] => looksLikeResult(entry[1]))
            .map(([key, value]) => toResultSet(key, value));
        if (results.length > 0) return { results, raw: null };
    }
    if (Array.isArray(parsed) && parsed.every(isRecord)) {
        return { results: [toResultSet("result", { data: parsed })], raw: null };
    }
    return { results: [], raw: trimmed };
}

// sql_query can carry trailing sections (e.g. the <<<SCHEMA>>> dump) from the generator agent
export function cleanSql(text: string | null | undefined): string | null {
    if (!text) return null;
    const marker = text.search(SECTION_MARKER);
    const sql = stripFences(marker === -1 ? text : text.slice(0, marker));
    return sql || null;
}

export function cleanError(text: string | null | undefined): string | null {
    const trimmed = text?.trim();
    if (!trimmed) return null;
    return trimmed.replace(/^invalid query:\s*/i, "") || trimmed;
}

function cleanItem(item: string) {
    return item.replace(/^\*\*(.+)\*\*$/, "$1").replace(/^["“](.+)["”]$/, "$1").trim();
}

// Pulls list items out of text, leaving the rest (intro and outro lines) as `text`
export function splitList(text: string | null | undefined): { text: string; items: string[] } {
    if (!text) return { text: "", items: [] };
    const items: string[] = [];
    const rest: string[] = [];
    for (const line of text.split("\n")) {
        const match = line.match(LIST_ITEM);
        if (match) items.push(cleanItem(match[1]));
        else rest.push(line);
    }
    return { text: rest.join("\n").replace(/\n{3,}/g, "\n\n").trim(), items: items.filter(Boolean) };
}

// SUGGESTIONS is "If you want, I can also show:\n1. …\n2. …\n\nJust tell me…"; only the items matter
export function parseSuggestions(text: string | null | undefined): { items: string[]; note: string | null } {
    const trimmed = text?.trim();
    if (!trimmed) return { items: [], note: null };
    const { items } = splitList(trimmed);
    return items.length > 0 ? { items, note: null } : { items: [], note: trimmed };
}

export function toCsv(result: ResultSet): string {
    const escape = (value: unknown) => {
        if (value === null || value === undefined) return "";
        const text = typeof value === "object" ? JSON.stringify(value) : String(value);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [result.columns.map(escape).join(",")];
    for (const row of result.rows) lines.push(result.columns.map((c) => escape(row[c])).join(","));
    return lines.join("\n");
}
