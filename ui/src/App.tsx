import { useCallback, useState } from 'react';
import './App.css'
import Sidebar from './components/Sidebar';
import UploadModal from './components/UploadModal';
import SchemaPanel from './components/SchemaPanel';
import ChatView from './components/ChatView';
import Composer from './components/Composer';
import { TableIcon } from './components/Icons';
import { useGlobalContext, type ChatItem } from './context/context';
import chatService, { getErrorMessage, newId, toChatItem } from './services/chatService';

function App() {
  const { fileSchema, setChatList, sessionId, setSessionId } = useGlobalContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const closeUpload = useCallback(() => setUploadOpen(false), []);
  const closeSchema = useCallback(() => setSchemaOpen(false), []);

  async function handleSend(message: string) {
    const userChatItem: ChatItem = { id: newId(), chatSender: "user", msgType: "query", chatMsg: message };
    setChatList((prev) => [...prev, userChatItem]);
    setSending(true);

    try {
      const response = await chatService.sendMessage(message, sessionId);
      if (response.session_id) setSessionId(response.session_id);
      setChatList((prev) => [...prev, toChatItem(response)]);
    } catch (error) {
      const errorChatItem: ChatItem = {
        id: newId(),
        chatSender: "error",
        msgType: "error_response",
        chatMsg: getErrorMessage(error),
      };
      setChatList((prev) => [...prev, errorChatItem]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onUploadClick={() => setUploadOpen(true)}
      />

      <main className="main">
        <header className="topbar">
          <h1 className="app-title">QueryChat</h1>
          <button
            className={`btn btn--outline${schemaOpen ? " btn--active" : ""}`}
            onClick={() => setSchemaOpen(!schemaOpen)}
            disabled={!fileSchema}
            title={fileSchema ? "View the file's tables and columns" : "Upload a file to see its schema"}
          >
            <TableIcon /> Schema
          </button>
        </header>

        <ChatView sending={sending} onUploadClick={() => setUploadOpen(true)} />
        <Composer disabled={!fileSchema} sending={sending} onSend={handleSend} />
      </main>

      {schemaOpen && <SchemaPanel onClose={closeSchema} />}
      {uploadOpen && <UploadModal onClose={closeUpload} onUploaded={() => setSidebarOpen(true)} />}
    </div>
  )
}

export default App
