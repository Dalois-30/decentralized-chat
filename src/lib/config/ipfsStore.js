import { create } from "zustand";
import { createIPFSNode } from '../config/ipfsConfig';
import { createOrbitDB } from './orbitDBConfig';

export const useIPFSStore = create((set, get) => ({
  ipfs: null,
  orbitdb: null,
  userDb: null,
  conversationDb: null,
  messageDb: null,
  isInitialized: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      if (get().isInitialized) return;

      // Initialiser IPFS
      const ipfs = await createIPFSNode();
      
      // Initialiser OrbitDB
      const orbitdb = await createOrbitDB(ipfs);
      const userDb = await orbitdb.docstore('users', {
        indexBy: 'id',
        replicate: true
      });
      const messageDb = await orbitdb.docstore('messages', {
        indexBy: 'id',
        replicate: true
      });
      const conversationDb = await orbitdb.docstore('conversations', {
        indexBy: 'id',
        replicate: true
      });
      await userDb.load();
      await messageDb.load();
      await conversationDb.load();

      set({
        ipfs,
        orbitdb,
        userDb,
        messageDb,
        conversationDb,
        isInitialized: true,
        isLoading: false,
        error: null
      });

    } catch (err) {
      set({ error: err.message, isLoading: false });
      console.error("Failed to initialize IPFS:", err);
    }
  },

  cleanup: async () => {
    const { ipfs, orbitdb, userDb } = get();
    
    try {
      if (userDb) await userDb.close();
      if (orbitdb) await orbitdb.disconnect();
      if (ipfs) await ipfs.stop();

      set({
        ipfs: null,
        orbitdb: null,
        userDb: null,
        messageDb: null,
        conversationDb: null,
        isInitialized: false
      });
    } catch (err) {
      console.error("Error during cleanup:", err);
    }
  }
}));