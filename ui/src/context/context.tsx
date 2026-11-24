import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import chatService, { getErrorMessage, newId, toChatItem } from "../services/chatService";
import { cleanSql, parseQueryResult, type ResultSet } from "../utils/responseParser";

export type ChatItem = {
    id: string;
    chatSender: "bot" | "user" | "error";
    msgType: "query" | "sql_response" | "greeting_response" | "error_response";
    chatMsg: string;
    results?: ResultSet[];
    // query_result text that wasn't the expected JSON (shown as-is)
    rawResult?: string | null;
    sqlQuery?: string | null;
    suggestions?: string[];
    error?: string | null;
    // Legacy: the unparsed query_result saved by older versions; migrated on load
    queryResult?: string | null;
}

export type Chat = {
    id: string;
    title: string;
    // Agent session on the backend; null until the first reply comes back
    sessionId: string | null;
    messages: ChatItem[];
    createdAt: number;
    updatedAt: number;
}

export type Column = {
    isPotentialPrimaryKey: boolean;
    name: string;
    nullCount: number;
    sampleValues: string[];
    type: string;
}

export type Table = {
    columnCount: number;
    rowCount: number;
    name: string;
    // Name of the table in the SQL database (differs from `name` for multi-sheet Excel files)
    sqlName: string;
    columns: Column[];
}

export type UploadedFile = {
    fileId: string;
    fileName: string;
    tableName: string;
    totalColumns?: number;
    totalRows?: number;
    totalTables?: number;
    tables: Table[];
}

interface GlobalContextType {
    // Files are global: shared by every chat
    files: UploadedFile[];
    maxFiles: number;
    filesLoading: boolean;
    filesError: string | null;
    addFile: (file: UploadedFile) => void;
    removeFile: (fileId: string) => Promise<void>;
    setMaxFiles: (max: number) => void;

    // Chats, newest activity first
    chats: Chat[];
    activeChat: Chat | null;
    selectChat: (chatId: string) => void;
    startNewChat: () => void;
    deleteChat: (chatId: string) => void;
    sendMessage: (message: string) => Promise<void>;
    isChatPending: (chatId: string | undefined) => boolean;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const useGlobalContext = () => {
    const context = useContext(GlobalContext);
    if (!context) {
        throw new Error("useGlobalContext must be used within AppContext");
    }
    return context;
}

const STORAGE_KEY = "querychat:chats";
const DEFAULT_MAX_FILES = 10;

type StoredChats = { chats: Chat[]; activeChatId: string | null };

function isChat(value: unknown): value is Chat {
    const chat = value as Chat;
    return !!chat && typeof chat.id === "string" && Array.isArray(chat.messages);
}

// Chats saved before results were parsed hold the raw query_result string
function migrateItem(item: ChatItem): ChatItem {
    if (item.queryResult === undefined || item.results) return item;
    const { results, raw } = parseQueryResult(item.queryResult);
    return { ...item, queryResult: undefined, results, rawResult: raw, sqlQuery: cleanSql(item.sqlQuery) };
}

function loadStoredChats(): StoredChats {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { chats: [], activeChatId: null };
        const parsed = JSON.parse(raw);
        const chats: Chat[] = Array.isArray(parsed?.chats)
            ? parsed.chats.filter(isChat).map((c: Chat) => ({ ...c, messages: c.messages.map(migrateItem) }))
            : [];
        const activeChatId = chats.some((c) => c.id === parsed.activeChatId) ? parsed.activeChatId : null;
        return { chats, activeChatId };
    } catch {
        return { chats: [], activeChatId: null };
    }
}

function makeTitle(message: string) {
    const oneLine = message.replace(/\s+/g, " ").trim();
    return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

interface AppContextProps {
    children: ReactNode;
}

const AppContext = ({ children }: AppContextProps) => {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [maxFiles, setMaxFiles] = useState(DEFAULT_MAX_FILES);
    const [filesLoading, setFilesLoading] = useState(true);
    const [filesError, setFilesError] = useState<string | null>(null);

    const [initial] = useState(loadStoredChats);
    const [chats, setChats] = useState<Chat[]>(initial.chats);
    // null means a fresh, not-yet-created chat; it is created on the first message
    const [activeChatId, setActiveChatId] = useState<string | null>(initial.activeChatId);
    const [pendingChatIds, setPendingChatIds] = useState<ReadonlySet<string>>(new Set());

    // Files live on the server, so load them on startup
    useEffect(() => {
        let cancelled = false;
        chatService.getFileStatus()
            .then((status) => {
                if (cancelled) return;
                setFiles(status.files);
                setMaxFiles(status.maxFiles);
                setFilesError(null);
            })
            .catch((error) => {
                if (!cancelled) setFilesError(getErrorMessage(error));
            })
            .finally(() => {
                if (!cancelled) setFilesLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    // Chats live only in this browser, so keep them across refreshes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats, activeChatId } satisfies StoredChats));
        } catch {
            // Storage full or blocked; chats still work for this page load
        }
    }, [chats, activeChatId]);

    const addFile = useCallback((file: UploadedFile) => {
        setFiles((prev) => [...prev.filter((f) => f.fileId !== file.fileId), file]);
    }, []);

    const removeFile = useCallback(async (fileId: string) => {
        await chatService.deleteFile(fileId);
        setFiles((prev) => prev.filter((f) => f.fileId !== fileId));
    }, []);

    const updateChat = useCallback((chatId: string, update: (chat: Chat) => Chat) => {
        setChats((prev) => prev.map((c) => (c.id === chatId ? update(c) : c)));
    }, []);

    const appendMessage = useCallback((chatId: string, item: ChatItem) => {
        updateChat(chatId, (c) => ({ ...c, messages: [...c.messages, item], updatedAt: Date.now() }));
    }, [updateChat]);

    const setPending = useCallback((chatId: string, pending: boolean) => {
        setPendingChatIds((prev) => {
            const next = new Set(prev);
            if (pending) next.add(chatId);
            else next.delete(chatId);
            return next;
        });
    }, []);

    const activeChat = useMemo(
        () => chats.find((c) => c.id === activeChatId) ?? null,
        [chats, activeChatId],
    );

    const sortedChats = useMemo(
        () => [...chats].sort((a, b) => b.updatedAt - a.updatedAt),
        [chats],
    );

    const startNewChat = useCallback(() => setActiveChatId(null), []);
    const selectChat = useCallback((chatId: string) => setActiveChatId(chatId), []);

    const deleteChat = useCallback((chatId: string) => {
        const chat = chats.find((c) => c.id === chatId);
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        setActiveChatId((current) => (current === chatId ? null : current));
        setPending(chatId, false);
        // Best effort: the chat is gone locally either way
        if (chat?.sessionId) chatService.deleteSession(chat.sessionId).catch(() => {});
    }, [chats, setPending]);

    const sendMessage = useCallback(async (message: string) => {
        let chatId = activeChat?.id;
        const sessionId = activeChat?.sessionId ?? null;

        if (!chatId) {
            const now = Date.now();
            const chat: Chat = { id: newId(), title: makeTitle(message), sessionId: null, messages: [], createdAt: now, updatedAt: now };
            chatId = chat.id;
            setChats((prev) => [chat, ...prev]);
            setActiveChatId(chat.id);
        }

        // Replies are routed by chatId, so switching chats mid-request is safe
        const targetId = chatId;
        appendMessage(targetId, { id: newId(), chatSender: "user", msgType: "query", chatMsg: message });
        setPending(targetId, true);

        try {
            const response = await chatService.sendMessage(message, sessionId);
            if (response.session_id) {
                const newSessionId = response.session_id;
                updateChat(targetId, (c) => ({ ...c, sessionId: newSessionId }));
            }
            appendMessage(targetId, toChatItem(response));
        } catch (error) {
            appendMessage(targetId, {
                id: newId(),
                chatSender: "error",
                msgType: "error_response",
                chatMsg: getErrorMessage(error),
            });
        } finally {
            setPending(targetId, false);
        }
    }, [activeChat, appendMessage, setPending, updateChat]);

    const isChatPending = useCallback(
        (chatId: string | undefined) => !!chatId && pendingChatIds.has(chatId),
        [pendingChatIds],
    );

    const value: GlobalContextType = {
        files, maxFiles, filesLoading, filesError, addFile, removeFile, setMaxFiles,
        chats: sortedChats, activeChat, selectChat, startNewChat, deleteChat, sendMessage, isChatPending,
    };

    return (
        <GlobalContext.Provider value={value}>
            {children}
        </GlobalContext.Provider>
    )
}

export default AppContext;
