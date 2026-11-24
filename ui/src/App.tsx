import { useCallback, useState } from 'react';
import './App.css'
import Sidebar from './components/Sidebar';
import UploadModal from './components/UploadModal';
import SchemaPanel from './components/SchemaPanel';
import ChatView from './components/ChatView';
import Composer from './components/Composer';
import { TableIcon } from './components/Icons';
import { useGlobalContext } from './context/context';

const NARROW_QUERY = "(max-width: 720px)";

function App() {
  const { files, activeChat, sendMessage, isChatPending } = useGlobalContext();
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(NARROW_QUERY).matches);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const closeUpload = useCallback(() => setUploadOpen(false), []);
  const closeSchema = useCallback(() => setSchemaOpen(false), []);

  const hasFiles = files.length > 0;
  const sending = isChatPending(activeChat?.id);

  // On small screens the sidebar covers the chat, so close it after picking a chat
  function handleNavigate() {
    if (window.matchMedia(NARROW_QUERY).matches) setSidebarOpen(false);
  }

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onUploadClick={() => setUploadOpen(true)}
        onNavigate={handleNavigate}
      />

      <main className="main">
        <header className="topbar">
          <div className="topbar__title">
            <h1 className="app-title">QueryChat</h1>
            <span className="topbar__chat" title={activeChat?.title}>{activeChat?.title ?? "New chat"}</span>
          </div>
          <button
            className={`btn btn--outline${schemaOpen ? " btn--active" : ""}`}
            onClick={() => setSchemaOpen(!schemaOpen)}
            disabled={!hasFiles}
            title={hasFiles ? "View the tables and columns of your files" : "Upload a file to see its schema"}
          >
            <TableIcon /> Schema
          </button>
        </header>

        <ChatView key={activeChat?.id ?? "new"} onUploadClick={() => setUploadOpen(true)} />
        <Composer disabled={!hasFiles} sending={sending} onSend={sendMessage} />
      </main>

      {schemaOpen && <SchemaPanel onClose={closeSchema} />}
      {uploadOpen && <UploadModal onClose={closeUpload} onUploaded={() => setSidebarOpen(true)} />}
    </div>
  )
}

export default App
