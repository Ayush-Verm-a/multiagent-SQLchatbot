import axios from "axios";
import { apiClient } from "../api/axiosConfig";
import type { ChatItem, Column, Table, UploadedFile } from "../context/context";
import { cleanError, cleanSql, parseQueryResult, parseSuggestions, splitList } from "../utils/responseParser";

// Shape of POST /api/chat. On success every field is present (text sections may be null);
// when the route rejects the request it returns only { error }.
export type ChatResponse = {
    status?: string;
    explanation?: string | null;
    // JSON string: { [queryName]: { success, summary, data, row_count, columns } }
    query_result?: string | null;
    sql_query?: string | null;
    selected_agent?: string | null;
    error?: string | null;
    session_id?: string;
    // Numbered list of follow-up questions wrapped in boilerplate text
    suggestions?: string | null;
    structured_response?: string | null;
}

type RawColumn = {
    name: string;
    type: string;
    null_count: number;
    is_potential_primary_key: boolean;
    sample_values: unknown[];
}

type RawTable = {
    name: string;
    row_count: number;
    column_count: number;
    columns: RawColumn[];
}

type RawSchema = {
    summary?: { total_columns: number; total_rows: number; total_tables: number };
    tables?: RawTable[];
} | null;

type RawFile = {
    file_id: string;
    filename: string;
    table_name: string;
    schema: RawSchema;
}

type UploadResponse = RawFile & {
    total_files: number;
    max_files: number;
}

type FileStatusResponse = {
    files: RawFile[];
    total_files: number;
    max_files: number;
}

export function newId() {
    return crypto.randomUUID();
}

export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === "string") return detail;
        if (!error.response) return "Can't reach the server. Is the backend running?";
        return error.message;
    }
    return (error as Error)?.message ?? "Something went wrong.";
}

export function toChatItem(response: ChatResponse): ChatItem {
    // The chat route returns only {"error": ...} when it rejects the request outright
    if (!response.status && response.error) {
        return { id: newId(), chatSender: "error", msgType: "error_response", chatMsg: response.error };
    }

    const explanation = (response.explanation || response.structured_response || "").trim();
    const { results, raw } = parseQueryResult(response.query_result);
    const sqlQuery = cleanSql(response.sql_query);
    const error = cleanError(response.error);
    const suggestions = parseSuggestions(response.suggestions);
    const hasData = results.length > 0 || !!raw || !!sqlQuery;

    // Invalid question with nothing friendly to say: show the reason as an error
    if (!explanation && !hasData && error) {
        return { id: newId(), chatSender: "error", msgType: "error_response", chatMsg: error };
    }

    // Greeting / small talk: the sample questions arrive as a numbered list inside the explanation
    if (!hasData && !error && suggestions.items.length === 0) {
        const { text, items } = splitList(explanation);
        const useItems = items.length > 0 && !!text;
        return {
            id: newId(),
            chatSender: "bot",
            msgType: "greeting_response",
            chatMsg: (useItems ? text : explanation) || "I didn't get an answer back. Please try asking again.",
            suggestions: useItems ? items : [],
        };
    }

    return {
        id: newId(),
        chatSender: "bot",
        msgType: "sql_response",
        chatMsg: [explanation, suggestions.note].filter(Boolean).join("\n\n"),
        results,
        rawResult: raw,
        sqlQuery,
        suggestions: suggestions.items,
        error,
    };
}

function toUploadedFile(raw: RawFile): UploadedFile {
    const rawTables = raw.schema?.tables ?? [];
    const tables: Table[] = rawTables.map((table) => ({
        name: table.name,
        // Mirrors load_file_to_db: multi-sheet files get one table per sheet
        sqlName: rawTables.length > 1 ? `${raw.table_name}_${table.name}`.replace(/ /g, "_") : raw.table_name,
        rowCount: table.row_count,
        columnCount: table.column_count,
        columns: table.columns.map((column): Column => ({
            name: column.name,
            type: column.type,
            nullCount: column.null_count,
            isPotentialPrimaryKey: column.is_potential_primary_key,
            sampleValues: column.sample_values.map(String),
        })),
    }));

    const summary = raw.schema?.summary;
    return {
        fileId: raw.file_id,
        fileName: raw.filename,
        tableName: raw.table_name,
        totalColumns: summary?.total_columns,
        totalRows: summary?.total_rows,
        totalTables: summary?.total_tables ?? tables.length,
        tables,
    };
}

class ChatService {
    getApi() {
        return apiClient.get("/");
    }

    async sendMessage(message: string, sessionId: string | null): Promise<ChatResponse> {
        const formData = new FormData();
        formData.append("message", message);
        if (sessionId) formData.append("session_id", sessionId);

        const res = await apiClient.post<ChatResponse>("/api/chat", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return res.data;
    }

    async uploadFile(file: File, onProgress: (percent: number) => void): Promise<{ file: UploadedFile; maxFiles: number }> {
        const formData = new FormData();
        formData.append("file", file);

        const res = await apiClient.post<UploadResponse>("/api/upload-file", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) => {
                onProgress(event.total ? Math.round((event.loaded * 100) / event.total) : 0);
            },
        });
        return { file: toUploadedFile(res.data), maxFiles: res.data.max_files };
    }

    async getFileStatus(): Promise<{ files: UploadedFile[]; maxFiles: number }> {
        const res = await apiClient.get<FileStatusResponse>("/api/file-status");
        return { files: (res.data.files ?? []).map(toUploadedFile), maxFiles: res.data.max_files };
    }

    async deleteFile(fileId: string): Promise<void> {
        await apiClient.delete(`/api/file/${encodeURIComponent(fileId)}`);
    }

    async deleteSession(sessionId: string): Promise<void> {
        await apiClient.delete(`/api/session/${encodeURIComponent(sessionId)}`);
    }
}

export default new ChatService();
