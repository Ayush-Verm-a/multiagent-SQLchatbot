export type ParsedTable = {
    headers: string[];
    rows: string[][];
}

function splitRow(line: string): string[] {
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
    return trimmed.split("|").map((cell) => cell.trim());
}

const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

// Parses the markdown table the agent returns in its QUERY_RESULT section.
// Returns null when the text isn't a table, so the caller can show it raw.
export function parseMarkdownTable(text: string): ParsedTable | null {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.includes("|"));
    const sepIndex = lines.findIndex((l) => SEPARATOR.test(l));
    if (sepIndex < 1) return null;

    const headers = splitRow(lines[sepIndex - 1]);
    const rows = lines.slice(sepIndex + 1).map(splitRow);
    return { headers, rows };
}
