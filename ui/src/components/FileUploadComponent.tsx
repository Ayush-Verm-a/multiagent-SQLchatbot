import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { apiClient } from "../api/axiosConfig";
import { useGlobalContext, type ChatItem, type Column, type FileSchema, type Table } from "../context/context";

type UploadStatus = "idle" | "uploading" | "success" | "error";

function FileUploadComponent() {
    const {file, setFile, setFileSchema, chatList, setChatList} = useGlobalContext();
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [uploadProgress, setUploadProgress] = useState(0);

    function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        if(e.target.files) {
            setFile(e.target.files[0]);
        }
    }

    async function handleFileUpload() {
        if(!file) return;

        setStatus("uploading");
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await apiClient.post("/api/upload-file", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                },
                onUploadProgress: (progressEvent) => {
                    const progress = progressEvent.total 
                    ? Math.round((progressEvent.loaded * 100) / progressEvent.total) 
                    : 0;

                    setUploadProgress(progress);
                }
            });

            const fs = res.data;
            const summary = fs.schema.summary;
            const tables = fs.schema.tables;

            const schemaTables: Table[] = []

            for(const table of tables) {
                const tableColumns: Column[] = [];
                for(const column of table.columns) {
                    const values: string[] = [];
                    for(const val of column.sample_values) {
                        values.push(val);
                    }

                    const columnAttributes: Column = {
                        isPotentialPrimaryKey: column.is_potential_primary_key,
                        name: column.name,
                        nullCount: column.null_count,
                        type: column.type,
                        sampleValues: values
                    };

                    tableColumns.push(columnAttributes);
                }

                const schemaTable: Table = {
                    columnCount: table.column_count,
                    rowCount: table.row_count,
                    name: table.name,
                    columns: tableColumns
                }

                schemaTables.push(schemaTable);
            }

            const fileSchema: FileSchema = {
                fileId: fs.file_id,
                fileName: fs.filename,
                totalColumns: summary.total_columns,
                totalRows: summary.total_rows,
                totalTables: summary.total_tables,
                tables: schemaTables
            }

            setFileSchema(fileSchema);

            const chatItem: ChatItem = {
                chatSender: "bot",
                msgType: "greeting_response",
                chatMsg: `${fileSchema.fileName} uploaded successfully!`
            }

            const newChatList = [...chatList];
            newChatList.push(chatItem);
            setChatList(newChatList);

            setStatus("success");
            setUploadProgress(100);

            console.log(res.data)
        } catch (error) {
            setStatus("error");
            setUploadProgress(0);
            console.log(error);
        }
    }

    return (
        <div>
            <h1>Upload File</h1>
            <input type="file" onChange={handleFileChange}/>
            {file && (
                <div className="idle">
                    <p>File Name: {file.name}</p>
                    <p>File Type: {file.type}</p>
                </div>
            )}
            {file && status != "uploading" && <button onClick={handleFileUpload}>Upload</button>}

            <p>File Upload Progress: {uploadProgress}%</p>

            {status === "success" && (
                <p className="success">File Uploaded successfully!</p>
            )}

            {status === "uploading" && (
                <p className="success">File Uploaded successfully!</p>
            )}

            {status === "error" && (
                <p className="error">Upload failed! Please try again</p>
            )}
        </div>
    )
}

export default FileUploadComponent;