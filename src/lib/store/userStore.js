// userStore.js
import { create as createZustand } from "zustand";
import { createIPFSNode } from './ipfsConfig';
import { createOrbitDBInstance } from './orbitDBConfig';

let userDb;
let ipfsNode;

const initOrbitDB = async () => {
  try {
    if (!ipfsNode) {
      ipfsNode = await createIPFSNode();
      window.ipfs = ipfsNode; // Pour le débogage
    }

    const orbitdb = await createOrbitDBInstance(ipfsNode);
    
    // Création d'un docstore avec la nouvelle API
    userDb = await orbitdb.open('users', {
      type: 'documents',
      indexBy: 'id'
    });

    console.log('OrbitDB User initialisé avec succès!', userDb);
    
    // await userDb.load();
    return userDb;
  } catch (err) {
    console.error("Échec de l'initialisation d'OrbitDB:", err);
    throw err;
  }
};

export const useUserStore = createZustand((set) => ({
  currentUser: null,
  isLoading: true,

  initDB: async () => {
    try {
      await initOrbitDB();
      set({ isLoading: false });
    } catch (err) {
      console.error("Échec de l'initialisation de la base de données:", err);
      set({ isLoading: false });
    }
  },

  createUser: async (userData) => {
    try {
      const user = {
        id: userData.walletAddress,
        walletAddress: userData.walletAddress,
        email: userData.email,
        username: userData.username,
        createdAt: Date.now(),
        blocked: [],
        lastSeen: Date.now(),
        status: 'online',
        avatar: userData.avatar || null,
        conversations: []
      };

      // Utilisation de la nouvelle API pour ajouter un document
      await userDb.add(user);
      set({ currentUser: user, isLoading: false });
      return user;
    } catch (err) {
      console.error("Échec de la création de l'utilisateur:", err);
      throw err;
    }
  },

  fetchUserInfo: async (walletAddress) => {
    if (!walletAddress) return set({ currentUser: null, isLoading: false });

    try {
      // Utilisation de la nouvelle API pour la recherche
      const user = await userDb.get(walletAddress);

      if (user) {
        const updatedUser = {
          ...user,
          lastSeen: Date.now(),
          status: 'online'
        };
        await userDb.add(updatedUser);
        set({ currentUser: updatedUser, isLoading: false });
      } else {
        set({ currentUser: null, isLoading: false });
      }
    } catch (err) {
      console.error("Échec de la récupération de l'utilisateur:", err);
      set({ currentUser: null, isLoading: false });
    }
  },

  updateUser: async (userData) => {
    try {
      await userDb.add(userData); // Utilisation de add au lieu de put
      set({ currentUser: userData });
    } catch (err) {
      console.error("Échec de la mise à jour de l'utilisateur:", err);
    }
  },

  setUserOffline: async () => {
    const currentUser = useUserStore.getState().currentUser;
    if (currentUser) {
      await userDb.add({
        ...currentUser,
        lastSeen: Date.now(),
        status: 'offline'
      });
    }
  }
}));