import { useState } from 'react';
import './App.css'
import FileUploadComponent from './components/FileUploadComponent'
import ChatComponent from './components/ChatComponent';
import Schema from './components/Schema';
import { useGlobalContext } from './context/context';

function App() {
  const {fileSchema} = useGlobalContext();
  const [schemaVisibility, setSchemaVisibility] = useState<boolean>(false);

  return (
    <div>
      <FileUploadComponent />
      {fileSchema && (
          <div>
            {
              !schemaVisibility && (<button onClick={() => setSchemaVisibility(true)}>Show Schema</button>)
            }
            {
              schemaVisibility && (<button onClick={() => setSchemaVisibility(false)}>Hide Schema</button>)
            }
          </div>
        )
      }
      {schemaVisibility && <Schema />}
      <ChatComponent />
    </div>
  )
}

export default App
