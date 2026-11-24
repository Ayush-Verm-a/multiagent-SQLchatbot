import { useEffect, useRef } from "react";
import { useGlobalContext } from "../context/context";
import MessageBubble from "./MessageBubble";
import { PlusIcon } from "./Icons";

interface ChatViewProps {
    onUploadClick: () => void;
}

function ChatView({ onUploadClick }: ChatViewProps) {
    const { activeChat, files, filesLoading, isChatPending, sendMessage } = useGlobalContext();
    const messages = activeChat?.messages ?? [];
    const sending = isChatPending(activeChat?.id);
    const endRef = useRef<HTMLDivElement>(null);
    const hasScrolled = useRef(false);

    useEffect(() => {
        // Jump straight to the bottom when a chat opens, then scroll smoothly for new messages
        endRef.current?.scrollIntoView({ behavior: hasScrolled.current ? "smooth" : "auto", block: "end" });
        hasScrolled.current = true;
    }, [messages.length, sending]);

    if (messages.length === 0) {
        if (!filesLoading && files.length === 0) {
            return (
                <div className="chat chat--empty">
                    <div className="empty">
                        <h2>Ask questions about your spreadsheets in plain English</h2>
                        <p>Upload .csv or .xlsx files and I'll turn your questions into SQL, run them, and show you the results.</p>
                        <button className="btn btn--dark" onClick={onUploadClick}>
                            <PlusIcon /> Upload files
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="chat chat--empty">
                <div className="empty">
                    <h2>What do you want to know?</h2>
                    {filesLoading ? (
                        <p>Loading your files…</p>
                    ) : (
                        <p>
                            Ask about {files.length === 1 ? "your file" : `any of your ${files.length} files`}:{" "}
                            {files.map((f) => f.fileName).join(", ")}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="chat">
            <div className="chat__inner">
                {messages.map((chat) => (
                    <MessageBubble
                        key={chat.id}
                        chat={chat}
                        onSuggestion={sendMessage}
                        suggestionsDisabled={sending || files.length === 0}
                    />
                ))}
                {sending && (
                    <div className="msg msg--bot msg--thinking" aria-live="polite">
                        <span className="dots"><i /><i /><i /></span> Thinking…
                    </div>
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
}

export default ChatView;
