import axios from "axios";
import { apiClient } from "../api/axiosConfig";
import type { ChatItem, Column, FileSchema, Table } from "../context/context";

export type ChatResponse = {
    status?: string;
    generic?: string;
    explanation?: string;
    query_result?: string | null;
    sql_query?: string | null;
    error?: string | null;
    session_id?: string;
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

type UploadResponse = {
    file_id: string;
    filename: string;
    schema: {
        summary: { total_columns: number; total_rows: number; total_tables: number };
        tables: RawTable[];
    };
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
    if (response.explanation && !response.query_result) {
        return { id: newId(), chatSender: "bot", msgType: "greeting_response", chatMsg: response.explanation };
    }

    // The chat route returns only {"error": ...} when it rejects the request outright
    if (!response.status && response.error) {
        return { id: newId(), chatSender: "error", msgType: "error_response", chatMsg: response.error };
    }

    return {
        id: newId(),
        chatSender: "bot",
        msgType: "sql_response",
        chatMsg: response.explanation ?? "",
        queryResult: response.query_result,
        sqlQuery: response.sql_query,
        error: response.error,
    };
}

function toFileSchema(data: UploadResponse): FileSchema {
    const tables: Table[] = data.schema.tables.map((table) => ({
        name: table.name,
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

    return {
        fileId: data.file_id,
        fileName: data.filename,
        totalColumns: data.schema.summary.total_columns,
        totalRows: data.schema.summary.total_rows,
        totalTables: data.schema.summary.total_tables,
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

    async uploadFile(file: File, onProgress: (percent: number) => void): Promise<FileSchema> {
        const formData = new FormData();
        formData.append("file", file);

        const res = await apiClient.post<UploadResponse>("/api/upload-file", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) => {
                onProgress(event.total ? Math.round((event.loaded * 100) / event.total) : 0);
            },
        });
        return toFileSchema(res.data);
    }
}

export default new ChatService();
