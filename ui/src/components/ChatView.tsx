import { useEffect, useRef } from "react";
import { useGlobalContext } from "../context/context";
import MessageBubble from "./MessageBubble";
import { PlusIcon } from "./Icons";

interface ChatViewProps {
    sending: boolean;
    onUploadClick: () => void;
}

function ChatView({ sending, onUploadClick }: ChatViewProps) {
    const { chatList, fileSchema } = useGlobalContext();
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [chatList, sending]);

    if (!fileSchema && chatList.length === 0) {
        return (
            <div className="chat chat--empty">
                <div className="empty">
                    <h2>Ask questions about your spreadsheet in plain English</h2>
                    <p>Upload a .csv or .xlsx file and I'll turn your questions into SQL, run them, and show you the results.</p>
                    <button className="btn btn--dark" onClick={onUploadClick}>
                        <PlusIcon /> Upload file
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="chat">
            <div className="chat__inner">
                {chatList.map((chat) => <MessageBubble key={chat.id} chat={chat} />)}
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
