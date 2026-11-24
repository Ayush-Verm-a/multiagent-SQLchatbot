import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useGlobalContext } from "../context/context";
import chatService, { getErrorMessage, newId } from "../services/chatService";
import { CheckIcon, FileIcon, UploadIcon, XIcon } from "./Icons";

const ACCEPTED = [".csv", ".xlsx", ".xls"];

type ItemStatus = "queued" | "uploading" | "done" | "error";

type QueueItem = {
    key: string;
    file: File;
    status: ItemStatus;
    progress: number;
    error?: string;
}

interface UploadModalProps {
    onClose: () => void;
    onUploaded: () => void;
}

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasAcceptedExtension(name: string) {
    const dot = name.lastIndexOf(".");
    return dot >= 0 && ACCEPTED.includes(name.slice(dot).toLowerCase());
}

function sameFile(a: File, b: File) {
    return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function itemMeta(item: QueueItem) {
    switch (item.status) {
        case "uploading":
            return item.progress < 100 ? `Uploading… ${item.progress}%` : "Reading schema…";
        case "done":
            return "Uploaded";
        case "error":
            return item.error ?? "Upload failed";
        default:
            return formatSize(item.file.size);
    }
}

function UploadModal({ onClose, onUploaded }: UploadModalProps) {
    const { files, maxFiles, addFile, setMaxFiles } = useGlobalContext();
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const remaining = Math.max(0, maxFiles - files.length);
    const queued = queue.filter((item) => item.status === "queued");
    const overLimit = queued.length > remaining;

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !uploading) onClose();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose, uploading]);

    function patchItem(key: string, patch: Partial<QueueItem>) {
        setQueue((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
    }

    function addFiles(picked: FileList | null) {
        if (!picked || picked.length === 0) return;
        const incoming = Array.from(picked);
        setQueue((prev) => {
            const next = [...prev];
            for (const file of incoming) {
                if (next.some((item) => sameFile(item.file, file))) continue;
                const valid = hasAcceptedExtension(file.name);
                next.push({
                    key: newId(),
                    file,
                    status: valid ? "queued" : "error",
                    progress: 0,
                    error: valid ? undefined : "Only .csv, .xlsx and .xls files are supported.",
                });
            }
            return next;
        });
    }

    function removeItem(key: string) {
        setQueue((prev) => prev.filter((item) => item.key !== key));
    }

    function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        addFiles(e.target.files);
        e.target.value = "";
    }

    function handleDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragOver(false);
        if (!uploading) addFiles(e.dataTransfer.files);
    }

    async function handleUpload() {
        if (queued.length === 0 || overLimit) return;
        setUploading(true);

        // One request per file, in order, so the server's duplicate and table-name checks see each previous file
        let failed = 0;
        for (const item of queued) {
            patchItem(item.key, { status: "uploading", progress: 0, error: undefined });
            try {
                const result = await chatService.uploadFile(item.file, (progress) => patchItem(item.key, { progress }));
                addFile(result.file);
                setMaxFiles(result.maxFiles);
                patchItem(item.key, { status: "done", progress: 100 });
            } catch (err) {
                failed += 1;
                patchItem(item.key, { status: "error", error: getErrorMessage(err) });
            }
        }

        setUploading(false);
        // Keep the modal open on failures so the reasons stay visible
        if (failed === 0) {
            onUploaded();
            onClose();
        }
    }

    const uploadLabel = queued.length > 1 ? `Upload ${queued.length} files` : "Upload";

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
                    <h2 id="upload-title">Upload data files</h2>
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
                    <p>Drop .csv or .xlsx files here</p>
                    <span className="dropzone__or">or</span>
                    <button className="btn btn--dark" onClick={() => inputRef.current?.click()} disabled={uploading}>
                        Browse files
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED.join(",")}
                        onChange={handleFileChange}
                        multiple
                        hidden
                    />
                </div>

                <p className="modal__hint">
                    {files.length} of {maxFiles} files used · {remaining} {remaining === 1 ? "slot" : "slots"} left.
                    New uploads are added alongside your existing files.
                </p>

                {queue.length > 0 && (
                    <ul className="upload-list">
                        {queue.map((item) => (
                            <li key={item.key} className={`upload-item upload-item--${item.status}`}>
                                <span className="file-card__icon">
                                    {item.status === "done" ? <CheckIcon /> : <FileIcon />}
                                </span>
                                <div className="file-card__text">
                                    <span className="file-card__name" title={item.file.name}>{item.file.name}</span>
                                    <span className="upload-item__meta">{itemMeta(item)}</span>
                                    {item.status === "uploading" && (
                                        <div className="progress__bar"><div style={{ width: `${item.progress}%` }} /></div>
                                    )}
                                </div>
                                {item.status !== "uploading" && (
                                    <button
                                        className="icon-btn icon-btn--sm"
                                        onClick={() => removeItem(item.key)}
                                        disabled={uploading}
                                        aria-label={`Remove ${item.file.name}`}
                                        title="Remove"
                                    >
                                        <XIcon />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {overLimit && (
                    <p className="notice notice--error">
                        You can add {remaining} more {remaining === 1 ? "file" : "files"}. Remove {queued.length - remaining} from the list, or delete files from the sidebar first.
                    </p>
                )}

                <div className="modal__actions">
                    <button className="btn btn--outline" onClick={onClose} disabled={uploading}>
                        {queue.some((item) => item.status === "done") ? "Done" : "Cancel"}
                    </button>
                    <button className="btn btn--accent" onClick={handleUpload} disabled={queued.length === 0 || overLimit || uploading}>
                        {uploading ? "Uploading…" : uploadLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default UploadModal;
