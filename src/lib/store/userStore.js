// userStore.js
import { create as createZustand } from "zustand";
import OrbitDB from 'orbit-db';
import { createIPFSNode } from './ipfsConfig';
import { createOrbitDB } from './orbitDBConfig';

let userDb;
let ipfsNode;

const initOrbitDB = async () => {
  try {
    if (!ipfsNode) {
      ipfsNode = await createIPFSNode();
      window.ipfs = ipfsNode; // Rendre disponible globalement
    }

    const orbitdb = await createOrbitDB(ipfsNode);
    userDb = await orbitdb.docstore('users', {
      indexBy: 'id',
      replicate: true
    });
    await userDb.load();
    return userDb;
  } catch (err) {
    console.error("Failed to initialize OrbitDB:", err);
    throw err;
  }
};

export const useUserStore = create((set) => ({
  currentUser: null,
  isLoading: true,

  initDB: async () => {
    try {
      await initOrbitDB();
      set({ isLoading: false });
    } catch (err) {
      console.error("Failed to initialize database:", err);
      set({ isLoading: false });
    }
  },

  // Create new user
  createUser: async (userData) => {
    try {
      const user = {
        id: userData.walletAddress, // Using wallet address as unique identifier
        walletAddress: userData.walletAddress,
        email: userData.email,
        username: userData.username,
        createdAt: Date.now(),
        blocked: [],
        lastSeen: Date.now(),
        status: 'online',
        avatar: userData.avatar || null,
        conversations: [] // Array of conversation IDs
      };

      await userDb.put(user);
      set({ currentUser: user, isLoading: false });
      return user;
    } catch (err) {
      console.error("Failed to create user:", err);
      throw err;
    }
  },

  fetchUserInfo: async (walletAddress) => {
    if (!walletAddress) return set({ currentUser: null, isLoading: false });

    try {
      const user = await userDb.get(walletAddress);

      if (user && user.length > 0) {
        set({ currentUser: user[0], isLoading: false });
        // Update last seen
        await userDb.put({
          ...user[0],
          lastSeen: Date.now(),
          status: 'online'
        });
      } else {
        set({ currentUser: null, isLoading: false });
      }
    } catch (err) {
      console.error("Failed to fetch user:", err);
      set({ currentUser: null, isLoading: false });
    }
  },

  updateUser: async (userData) => {
    try {
      await userDb.put(userData);
      set({ currentUser: userData });
    } catch (err) {
      console.error("Failed to update user:", err);
    }
  },

  setUserOffline: async () => {
    const currentUser = useUserStore.getState().currentUser;
    if (currentUser) {
      await userDb.put({
        ...currentUser,
        lastSeen: Date.now(),
        status: 'offline'
      });
    }
  }
}));