import { useEffect, useState } from "react";
import { useIPFSStore } from "./lib/config/ipfsStore";
import { useUserStore } from "./lib/store/userStore";
import { useMessageStore } from "./lib/store/messageStore";
import { useConversationStore } from "./lib/store/chatStore";

const App = () => {
  const [networkStatus, setNetworkStatus] = useState('connecting');
  const [peerCount, setPeerCount] = useState(0);

  // Stores initialization
  const { 
    initialize: initIPFS, 
    cleanup: cleanupIPFS,
    ipfs: ipfsNode
  } = useIPFSStore();
  
  const { initDB: initUserDB } = useUserStore();
  const { initDB: initMessageDB } = useMessageStore();
  const { initDB: initConversationDB } = useConversationStore();

  useEffect(() => {
    const initializeNetwork = async () => {
      try {
        setNetworkStatus('connecting');

        // Initialize IPFS and OrbitDB through IPFSStore
        await initIPFS();
        
        if (!ipfsNode) {
          throw new Error("IPFS initialization failed");
        }

        // Wait for IPFS node to be ready
        await ipfsNode.ready();
        
        // Initialize all stores
        await Promise.all([
          initUserDB(),
          initMessageDB(),
          initConversationDB()
        ]);

        // Get initial peer count
        const peers = await ipfsNode.swarm.peers();
        setPeerCount(peers.length);
        
        // Setup network diagnostics
        const nodeInfo = await ipfsNode.id();
        console.log('IPFS node ID:', nodeInfo.id);
        
        // Setup peer connection listeners
        ipfsNode.libp2p.addEventListener('peer:connect', (evt) => {
          console.log('Connected to peer:', evt.detail.remotePeer.toString());
          setPeerCount(prev => prev + 1);
        });
        
        ipfsNode.libp2p.addEventListener('peer:disconnect', (evt) => {
          console.log('Disconnected from peer:', evt.detail.remotePeer.toString());
          setPeerCount(prev => Math.max(0, prev - 1));
        });

        setNetworkStatus('connected');
        
      } catch (error) {
        console.error('Failed to initialize network:', error);
        setNetworkStatus('error');
      }
    };

    initializeNetwork();
    
    // Cleanup function
    return () => {
      const cleanup = async () => {
        await Promise.all([
          cleanupIPFS(),
          useMessageStore.getState().cleanup(),
          useConversationStore.getState().cleanup()
        ]);
      };
      cleanup();
    };
  }, []);

  // Network status components
  const NetworkLoading = () => (
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <div className="text-lg">Connecting to decentralized network...</div>
      <div className="text-sm text-gray-500">This might take a few moments</div>
    </div>
  );

  const NetworkError = () => (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-red-500 text-lg">Failed to connect to network</div>
      <div className="text-sm text-gray-500">Please check your internet connection</div>
      <button 
        onClick={() => window.location.reload()}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
      >
        Retry Connection
      </button>
    </div>
  );

  const NetworkStatus = () => (
    <div className="fixed bottom-4 right-4 bg-white rounded-full px-4 py-2 shadow-lg flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${peerCount > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
      <span className="text-sm text-gray-600">{peerCount} peers connected</span>
    </div>
  );

  // Loading and error states
  if (networkStatus !== 'connected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            {networkStatus === 'connecting' ? <NetworkLoading /> : <NetworkError />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Add your chat application components here */}
      <NetworkStatus />
    </div>
  );
};

export default App;