import { useState } from "react";
import { useGlobalContext, type Chat, type UploadedFile } from "../context/context";
import { getErrorMessage } from "../services/chatService";
import { FileIcon, NewChatIcon, PanelIcon, PlusIcon, TrashIcon } from "./Icons";

interface SidebarProps {
    open: boolean;
    onToggle: () => void;
    onUploadClick: () => void;
    onNavigate: () => void;
}

function fileMeta(file: UploadedFile) {
    const tables = file.totalTables ?? file.tables.length;
    const parts = [`${tables} ${tables === 1 ? "table" : "tables"}`];
    if (file.totalRows != null) parts.push(`${file.totalRows.toLocaleString()} rows`);
    return parts.join(" · ");
}

function Sidebar({ open, onToggle, onUploadClick, onNavigate }: SidebarProps) {
    const {
        chats, activeChat, selectChat, startNewChat, deleteChat, isChatPending,
        files, maxFiles, filesLoading, filesError, removeFile,
    } = useGlobalContext();
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
    const [fileActionError, setFileActionError] = useState<string | null>(null);

    function handleNewChat() {
        startNewChat();
        onNavigate();
    }

    function handleSelectChat(chat: Chat) {
        selectChat(chat.id);
        onNavigate();
    }

    function handleDeleteChat(chat: Chat) {
        if (!window.confirm(`Delete "${chat.title}"? This can't be undone.`)) return;
        deleteChat(chat.id);
    }

    async function handleDeleteFile(file: UploadedFile) {
        if (!window.confirm(`Delete ${file.fileName}? Every chat will lose access to its data.`)) return;
        setDeletingFileId(file.fileId);
        setFileActionError(null);
        try {
            await removeFile(file.fileId);
        } catch (error) {
            setFileActionError(getErrorMessage(error));
        } finally {
            setDeletingFileId(null);
        }
    }

    if (!open) {
        return (
            <aside className="sidebar sidebar--collapsed">
                <button className="icon-btn" onClick={onToggle} aria-label="Open sidebar" title="Open sidebar">
                    <PanelIcon />
                </button>
                <button className="icon-btn" onClick={handleNewChat} aria-label="New chat" title="New chat">
                    <NewChatIcon />
                </button>
                <button className="icon-btn icon-btn--dark" onClick={onUploadClick} aria-label="Upload files" title="Upload files">
                    <PlusIcon />
                </button>
            </aside>
        );
    }

    return (
        <aside className="sidebar">
            <div className="sidebar__header">
                <button className="btn btn--dark sidebar__new" onClick={handleNewChat}>
                    <NewChatIcon /> New chat
                </button>
                <button className="icon-btn" onClick={onToggle} aria-label="Collapse sidebar" title="Collapse sidebar">
                    <PanelIcon />
                </button>
            </div>

            <section className="sidebar__section sidebar__section--chats" aria-label="Chats">
                <span className="sidebar__label">Chats</span>
                {chats.length === 0 ? (
                    <p className="sidebar__hint">No chats yet. Ask a question to start one.</p>
                ) : (
                    <ul className="chat-list">
                        {chats.map((chat) => {
                            const active = chat.id === activeChat?.id;
                            return (
                                <li key={chat.id} className={`chat-item${active ? " chat-item--active" : ""}`}>
                                    <button
                                        className="chat-item__open"
                                        onClick={() => handleSelectChat(chat)}
                                        aria-current={active ? "page" : undefined}
                                        title={chat.title}
                                    >
                                        {isChatPending(chat.id) && <span className="chat-item__pending" aria-label="Waiting for reply" />}
                                        <span className="chat-item__title">{chat.title || "Untitled chat"}</span>
                                    </button>
                                    <button
                                        className="icon-btn icon-btn--sm chat-item__delete"
                                        onClick={() => handleDeleteChat(chat)}
                                        aria-label={`Delete chat ${chat.title}`}
                                        title="Delete chat"
                                    >
                                        <TrashIcon />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="sidebar__section sidebar__section--files" aria-label="Files">
                <div className="sidebar__row">
                    <span className="sidebar__label">Files · {files.length}/{maxFiles}</span>
                    <button
                        className="icon-btn icon-btn--sm"
                        onClick={onUploadClick}
                        disabled={files.length >= maxFiles}
                        aria-label="Upload files"
                        title={files.length >= maxFiles ? "File limit reached" : "Upload files"}
                    >
                        <PlusIcon />
                    </button>
                </div>

                {filesError && <p className="notice notice--error">{filesError}</p>}
                {fileActionError && <p className="notice notice--error">{fileActionError}</p>}

                {filesLoading ? (
                    <p className="sidebar__hint">Loading files…</p>
                ) : files.length === 0 ? (
                    <>
                        <p className="sidebar__hint">No files yet. Upload .csv or .xlsx files to start.</p>
                        <button className="btn btn--outline btn--block" onClick={onUploadClick}>
                            <PlusIcon /> Upload files
                        </button>
                    </>
                ) : (
                    <ul className="file-list">
                        {files.map((file) => (
                            <li key={file.fileId} className="file-card">
                                <span className="file-card__icon"><FileIcon /></span>
                                <div className="file-card__text">
                                    <span className="file-card__name" title={file.fileName}>{file.fileName}</span>
                                    <span className="file-card__meta">{fileMeta(file)}</span>
                                </div>
                                <button
                                    className="icon-btn icon-btn--sm file-card__delete"
                                    onClick={() => handleDeleteFile(file)}
                                    disabled={deletingFileId === file.fileId}
                                    aria-label={`Delete ${file.fileName}`}
                                    title="Delete file"
                                >
                                    <TrashIcon />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </aside>
    );
}

export default Sidebar;
