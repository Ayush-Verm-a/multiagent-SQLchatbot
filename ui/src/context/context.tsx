import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";

export type ChatItem = {
    chatSender: "bot" | "user" | "error";
    msgType: "query" | "sql_response" | "greeting_response" | "error_response";
    chatMsg: string;
}

export type ChatList = ChatItem[]

export type Column = {
    isPotentialPrimaryKey: boolean;
    name: string;
    nullCount: number;
    sampleValues: string[];
    type: string;
}

export type Table = {
    columnCount: number;
    rowCount: number;
    name: string;
    columns: Column[];
}

export type FileSchema = {
    fileId?: string;
    fileName?: string;
    totalColumns?: number;
    totalRows?: number;
    totalTables?: number;
    tables?: Table[];
}

interface GlobalContextType {
    file: File | null;
    setFile: Dispatch<SetStateAction<File | null>>;
    fileSchema: FileSchema | null;
    setFileSchema: Dispatch<SetStateAction<FileSchema | null>>;
    chatList: ChatList;
    setChatList: Dispatch<SetStateAction<ChatList>>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const useGlobalContext = () => {
    const context = useContext(GlobalContext);
    if (!context) {
        throw new Error("useGlobalContext must be used within AppContext");
    }
    return context;
}

interface AppContextProps {
    children: ReactNode;
}

const AppContext = ({children}: AppContextProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [fileSchema, setFileSchema] = useState<FileSchema | null>(null);
    const [chatList, setChatList] = useState<ChatList>([]);

    return (
        <GlobalContext.Provider value={{file, setFile, fileSchema, setFileSchema, chatList, setChatList}}>
            {children}
        </GlobalContext.Provider>
    )
}

export default AppContext;