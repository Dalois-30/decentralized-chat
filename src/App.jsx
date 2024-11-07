
// App.js
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { createOrbitDBInstance } from "./lib/config/orbitDBConfig";
// import { useUserStore } from "./lib/store/userStore";
// import { useChatStore } from "./lib/store/chatStore";
// import { useMessageStore } from "./lib/store/messageStore";

const App = () => {
  const [orbitdb, setOrbitdb] = useState(null);
  const [networkStatus, setNetworkStatus] = useState('connecting');
  // const { initDB } = useUserStore();
  // const { initMessageDB } = useMessageStore();

  // Initialisation du réseau P2P
  useEffect(() => {
    const initializeNetwork = async () => {
      try {
        setNetworkStatus('connecting');
        // Créer l'instance OrbitDB
        const orbit = await createOrbitDBInstance();
        setOrbitdb(orbit);
        
      } catch (error) {
        console.error('Failed to initialize network:', error);
        setNetworkStatus('error');
      }
    };

    initializeNetwork();
    
    // Cleanup
    return () => {
      const cleanup = async () => {
        if (orbitdb) {
          await orbitdb.disconnect();
        }
      };
      cleanup();
    };
  }, []);

  // Affichage de l'état de la connexion
  if (networkStatus !== 'connected') {
    return (
      <div className="network-status">
        <div className="status-message">
          {networkStatus === 'connecting' && 'Connecting to decentralized network...'}
          {networkStatus === 'error' && 'Failed to connect to network. Please try again.'}
        </div>
        {networkStatus === 'error' && (
          <button onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  // Le reste de votre composant App...
  return (
    <div className="container">
      {/* Votre contenu existant */}
    </div>
  );
};

export default App;