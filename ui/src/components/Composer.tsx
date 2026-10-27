import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { SendIcon } from "./Icons";

interface ComposerProps {
    disabled: boolean;
    sending: boolean;
    onSend: (message: string) => void;
}

function Composer({ disabled, sending, onSend }: ComposerProps) {
    const [query, setQuery] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const canSend = !disabled && !sending && query.trim().length > 0;

    // Grow with the text, up to the max-height set in CSS
    useLayoutEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        // scrollHeight excludes borders, but the box is border-box sized
        el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    }, [query]);

    function handleSend() {
        if (!canSend) return;
        onSend(query.trim());
        setQuery("");
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div className="composer">
            <div className="composer__inner">
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder={disabled ? "Upload a file to start asking…" : "Ask a question about your data…"}
                    aria-label="Your question"
                />
                <button className="btn btn--accent composer__send" onClick={handleSend} disabled={!canSend}>
                    <SendIcon /> Send
                </button>
            </div>
            <p className="composer__hint">Enter to send · Shift + Enter for a new line</p>
        </div>
    );
}

export default Composer;
