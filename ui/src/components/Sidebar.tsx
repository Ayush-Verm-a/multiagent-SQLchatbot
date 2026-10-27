import { useGlobalContext } from "../context/context";
import { FileIcon, PanelIcon, PlusIcon } from "./Icons";

interface SidebarProps {
    open: boolean;
    onToggle: () => void;
    onUploadClick: () => void;
}

function Sidebar({ open, onToggle, onUploadClick }: SidebarProps) {
    const { fileSchema } = useGlobalContext();

    if (!open) {
        return (
            <aside className="sidebar sidebar--collapsed">
                <button className="icon-btn" onClick={onToggle} aria-label="Open sidebar" title="Open sidebar">
                    <PanelIcon />
                </button>
                <button className="icon-btn icon-btn--dark" onClick={onUploadClick} aria-label="Upload file" title="Upload file">
                    <PlusIcon />
                </button>
            </aside>
        );
    }

    return (
        <aside className="sidebar">
            <div className="sidebar__header">
                <span className="sidebar__label">Files</span>
                <button className="icon-btn" onClick={onToggle} aria-label="Collapse sidebar" title="Collapse sidebar">
                    <PanelIcon />
                </button>
            </div>

            <button className="btn btn--dark btn--block" onClick={onUploadClick}>
                <PlusIcon /> Upload file
            </button>

            {fileSchema ? (
                <div className="file-card">
                    <span className="file-card__icon"><FileIcon /></span>
                    <div className="file-card__text">
                        <span className="file-card__name" title={fileSchema.fileName}>{fileSchema.fileName}</span>
                        <span className="file-card__meta">
                            {fileSchema.totalTables} {fileSchema.totalTables === 1 ? "table" : "tables"} · {fileSchema.totalRows?.toLocaleString()} rows
                        </span>
                    </div>
                </div>
            ) : (
                <p className="sidebar__hint">No file yet. Upload a .csv or .xlsx to start.</p>
            )}
        </aside>
    );
}

export default Sidebar;
