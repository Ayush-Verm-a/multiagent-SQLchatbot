import { useGlobalContext } from "../context/context";

function Schema() {
    const {fileSchema} = useGlobalContext();

    if (!fileSchema) {
        return <p>No schema available. Upload a file to see its schema.</p>;
    }

    const tables = fileSchema.tables ?? [];

    return (
        <div>
            <h2>Schema{fileSchema.fileName ? `: ${fileSchema.fileName}` : ""}</h2>
            <p>
                Tables: {fileSchema.totalTables ?? tables.length} | Columns: {fileSchema.totalColumns ?? "-"} | Rows: {fileSchema.totalRows ?? "-"}
            </p>

            {tables.map((table) => (
                <div key={table.name}>
                    <h3>{table.name}</h3>
                    <p>{table.columnCount} columns, {table.rowCount} rows</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Column</th>
                                <th>Type</th>
                                <th>Null Count</th>
                                <th>Potential PK</th>
                                <th>Sample Values</th>
                            </tr>
                        </thead>
                        <tbody>
                            {table.columns.map((column) => (
                                <tr key={column.name}>
                                    <td>{column.name}</td>
                                    <td>{column.type}</td>
                                    <td>{column.nullCount}</td>
                                    <td>{column.isPotentialPrimaryKey ? "Yes" : "No"}</td>
                                    <td>{column.sampleValues.join(", ")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    )
}

export default Schema;
