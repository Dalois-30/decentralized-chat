
// App.js
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { createIPFSNode } from "./lib/config/ipfsConfig";
import { createOrbitDB } from "./lib/config/orbitDBConfig";
import { useUserStore } from "./lib/store/userStore";
import { useChatStore } from "./lib/store/chatStore";
import { useMessageStore } from "./lib/store/messageStore";

const App = () => {
  const [ipfsNode, setIpfsNode] = useState(null);
  const [orbitdb, setOrbitdb] = useState(null);
  const [networkStatus, setNetworkStatus] = useState('connecting');
  const { initDB } = useUserStore();
  const { initMessageDB } = useMessageStore();

  // Initialisation du réseau P2P
  useEffect(() => {
    const initializeNetwork = async () => {
      try {
        setNetworkStatus('connecting');
        
        // Créer le nœud IPFS
        const node = await createIPFSNode();
        setIpfsNode(node);
        
        // Attendre la connexion aux pairs
        await node.ready();
        const peers = await node.swarm.peers();
        console.log('Connected to peers:', peers.length);
        
        // Créer l'instance OrbitDB
        const orbit = await createOrbitDB(node);
        setOrbitdb(orbit);
        
        // Initialiser les stores avec l'instance OrbitDB
        await initDB(orbit);
        await initMessageDB(orbit);
        
        setNetworkStatus('connected');
        
        // Log des informations de diagnostic
        const nodeInfo = await node.id();
        console.log('IPFS node ID:', nodeInfo.id);
        console.log('IPFS node addresses:', nodeInfo.addresses);
        
        // Mettre en place des listeners pour la connexion aux pairs
        node.libp2p.addEventListener('peer:connect', (evt) => {
          console.log('Connected to peer:', evt.detail.remotePeer.toString());
        });
        
        node.libp2p.addEventListener('peer:disconnect', (evt) => {
          console.log('Disconnected from peer:', evt.detail.remotePeer.toString());
        });
        
      } catch (error) {
        console.error('Failed to initialize network:', error);
        setNetworkStatus('error');
      }
    };

    initializeNetwork();
    
    // Cleanup
    return () => {
      const cleanup = async () => {
        if (ipfsNode) {
          await ipfsNode.stop();
        }
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