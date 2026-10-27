import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useGlobalContext, type ChatItem } from "../context/context";
import chatService, { getErrorMessage, newId } from "../services/chatService";
import { FileIcon, UploadIcon, XIcon } from "./Icons";

type UploadStatus = "idle" | "uploading" | "error";

const ACCEPTED = [".csv", ".xlsx", ".xls"];

interface UploadModalProps {
    onClose: () => void;
    onUploaded: () => void;
}

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadModal({ onClose, onUploaded }: UploadModalProps) {
    const { setFileSchema, setChatList, setSessionId } = useGlobalContext();
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const uploading = status === "uploading";

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !uploading) onClose();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose, uploading]);

    function pickFile(picked: File | undefined) {
        if (!picked) return;
        const ext = picked.name.slice(picked.name.lastIndexOf(".")).toLowerCase();
        if (!ACCEPTED.includes(ext)) {
            setFile(null);
            setStatus("error");
            setError("Only .csv, .xlsx and .xls files are supported.");
            return;
        }
        setFile(picked);
        setStatus("idle");
        setError(null);
    }

    function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        pickFile(e.target.files?.[0]);
        e.target.value = "";
    }

    function handleDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragOver(false);
        if (!uploading) pickFile(e.dataTransfer.files[0]);
    }

    async function handleFileUpload() {
        if (!file) return;

        setStatus("uploading");
        setProgress(0);
        setError(null);

        try {
            const fileSchema = await chatService.uploadFile(file, setProgress);
            setFileSchema(fileSchema);
            // A new file means a new dataset, so start a fresh agent session
            setSessionId(null);

            const chatItem: ChatItem = {
                id: newId(),
                chatSender: "bot",
                msgType: "greeting_response",
                chatMsg: `${fileSchema.fileName} uploaded successfully! Ask me anything about it.`,
            };
            setChatList((prev) => [...prev, chatItem]);

            onUploaded();
            onClose();
        } catch (err) {
            setStatus("error");
            setProgress(0);
            setError(getErrorMessage(err));
        }
    }

    return (
        <div className="overlay" onMouseDown={() => !uploading && onClose()}>
            <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-title"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="modal__header">
                    <h2 id="upload-title">Upload a data file</h2>
                    <button className="icon-btn" onClick={onClose} disabled={uploading} aria-label="Close">
                        <XIcon />
                    </button>
                </div>

                <div
                    className={`dropzone${dragOver ? " dropzone--over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <UploadIcon />
                    <p>Drop a .csv or .xlsx file here</p>
                    <span className="dropzone__or">or</span>
                    <button className="btn btn--dark" onClick={() => inputRef.current?.click()} disabled={uploading}>
                        Browse files
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED.join(",")}
                        onChange={handleFileChange}
                        hidden
                    />
                </div>

                {file && (
                    <div className="file-card file-card--selected">
                        <span className="file-card__icon"><FileIcon /></span>
                        <div className="file-card__text">
                            <span className="file-card__name">{file.name}</span>
                            <span className="file-card__meta">{formatSize(file.size)}</span>
                        </div>
                    </div>
                )}

                {uploading && (
                    <div className="progress">
                        <div className="progress__bar"><div style={{ width: `${progress}%` }} /></div>
                        <span className="progress__label">
                            {progress === 0 ? "Uploading…" : progress < 100 ? `Uploading… ${progress}%` : "Reading schema…"}
                        </span>
                    </div>
                )}

                {error && <p className="notice notice--error">{error}</p>}

                <div className="modal__actions">
                    <button className="btn btn--outline" onClick={onClose} disabled={uploading}>Cancel</button>
                    <button className="btn btn--accent" onClick={handleFileUpload} disabled={!file || uploading}>
                        {uploading ? "Uploading…" : "Upload"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default UploadModal;
