import { useEffect, useState } from "react";
import { useGlobalContext, type Table } from "../context/context";
import { ChevronIcon, FileIcon, XIcon } from "./Icons";

interface SchemaPanelProps {
    onClose: () => void;
}

function SchemaTable({ table, defaultOpen }: { table: Table; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="schema-table">
            <button className="schema-table__header" onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className={`chevron${open ? " chevron--open" : ""}`}><ChevronIcon /></span>
                <span className="schema-table__name" title={`SQL table: ${table.sqlName}`}>{table.sqlName}</span>
                <span className="schema-table__meta">
                    {table.columnCount} cols · {table.rowCount.toLocaleString()} rows
                </span>
            </button>

            {open && (
                <ul className="schema-cols">
                    {table.columns.map((column) => (
                        <li key={column.name} className="schema-col">
                            <div className="schema-col__row">
                                <code>{column.name}</code>
                                <span className="schema-col__tags">
                                    {column.isPotentialPrimaryKey && <span className="pill pill--pk">PK</span>}
                                    <span className="pill">{column.type}</span>
                                </span>
                            </div>
                            <div className="schema-col__samples">
                                {column.sampleValues.length > 0
                                    ? <>e.g. {column.sampleValues.join(", ")}</>
                                    : "No sample values"}
                                {column.nullCount > 0 && <> · {column.nullCount.toLocaleString()} nulls</>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function SchemaPanel({ onClose }: SchemaPanelProps) {
    const { files } = useGlobalContext();

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    if (files.length === 0) return null;

    const sum = (pick: (f: (typeof files)[number]) => number | undefined) =>
        files.reduce((total, f) => total + (pick(f) ?? 0), 0);
    const totalTables = sum((f) => f.totalTables ?? f.tables.length);
    const totalColumns = sum((f) => f.totalColumns);
    const totalRows = sum((f) => f.totalRows);

    return (
        <>
            <div className="drawer-scrim" onClick={onClose} />
            <aside className="drawer" aria-label="Schema">
                <div className="drawer__header">
                    <div>
                        <span className="drawer__eyebrow">Schema</span>
                        <h2>{files.length === 1 ? files[0].fileName : `${files.length} files`}</h2>
                    </div>
                    <button className="icon-btn" onClick={onClose} aria-label="Close schema"><XIcon /></button>
                </div>

                <div className="stats">
                    <div className="stat"><b>{totalTables.toLocaleString()}</b>tables</div>
                    <div className="stat"><b>{totalColumns.toLocaleString()}</b>columns</div>
                    <div className="stat"><b>{totalRows.toLocaleString()}</b>rows</div>
                </div>

                <div className="drawer__body">
                    {files.map((file, fileIndex) => (
                        <section key={file.fileId} className="schema-file">
                            <div className="schema-file__header" title={file.fileName}>
                                <FileIcon />
                                <span className="schema-file__name">{file.fileName}</span>
                            </div>
                            {file.tables.length === 0 && <p className="sidebar__hint">No schema available.</p>}
                            {file.tables.map((table, i) => (
                                <SchemaTable key={table.sqlName} table={table} defaultOpen={fileIndex === 0 && i === 0} />
                            ))}
                        </section>
                    ))}
                </div>
            </aside>
        </>
    );
}

export default SchemaPanel;
