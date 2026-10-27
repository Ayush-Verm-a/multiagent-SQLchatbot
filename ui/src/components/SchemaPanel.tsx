import { useEffect, useState } from "react";
import { useGlobalContext, type Table } from "../context/context";
import { ChevronIcon, XIcon } from "./Icons";

interface SchemaPanelProps {
    onClose: () => void;
}

function SchemaTable({ table, defaultOpen }: { table: Table; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="schema-table">
            <button className="schema-table__header" onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className={`chevron${open ? " chevron--open" : ""}`}><ChevronIcon /></span>
                <span className="schema-table__name">{table.name}</span>
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
    const { fileSchema } = useGlobalContext();

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    if (!fileSchema) return null;
    const tables = fileSchema.tables ?? [];

    return (
        <>
            <div className="drawer-scrim" onClick={onClose} />
            <aside className="drawer" aria-label="Schema">
                <div className="drawer__header">
                    <div>
                        <span className="drawer__eyebrow">Schema</span>
                        <h2 title={fileSchema.fileName}>{fileSchema.fileName}</h2>
                    </div>
                    <button className="icon-btn" onClick={onClose} aria-label="Close schema"><XIcon /></button>
                </div>

                <div className="stats">
                    <div className="stat"><b>{fileSchema.totalTables ?? tables.length}</b>tables</div>
                    <div className="stat"><b>{fileSchema.totalColumns?.toLocaleString() ?? "–"}</b>columns</div>
                    <div className="stat"><b>{fileSchema.totalRows?.toLocaleString() ?? "–"}</b>rows</div>
                </div>

                <div className="drawer__body">
                    {tables.map((table, i) => (
                        <SchemaTable key={table.name} table={table} defaultOpen={i === 0} />
                    ))}
                </div>
            </aside>
        </>
    );
}

export default SchemaPanel;
