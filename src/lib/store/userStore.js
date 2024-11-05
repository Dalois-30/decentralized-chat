import { create } from "zustand";
import { useIPFSStore } from "../config/ipfsStore";

/**
 * Store Zustand pour la gestion des utilisateurs
 * Intègre la gestion des états utilisateur avec IPFS/OrbitDB
 */
export const useUserStore = create((set, get) => ({
  // État initial
  currentUser: null,
  isLoading: true,
  error: null,
  onlineUsers: new Set(),
  
  /**
   * Initialise la base de données utilisateurs
   */
  initDB: async () => {
    const ipfsStore = useIPFSStore.getState();
    
    try {
      if (!ipfsStore.isInitialized) {
        await ipfsStore.initialize();
      }
      set({ isLoading: false, error: null });
    } catch (err) {
      set({ 
        isLoading: false, 
        error: "Échec de l'initialisation de la base de données: " + err.message 
      });
      console.error("Failed to initialize database:", err);
    }
  },

  /**
   * Crée un nouvel utilisateur
   * @param {Object} userData - Données de l'utilisateur à créer
   * @returns {Promise<Object>} Utilisateur créé
   */
  createUser: async (userData) => {
    const { userDb } = useIPFSStore.getState();
    set({ isLoading: true, error: null });
    
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await userDb.get(userData.walletAddress);
      if (existingUser && existingUser.length > 0) {
        throw new Error("Un utilisateur avec cette adresse existe déjà");
      }

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
        conversations: [],
        preferences: {
          notifications: true,
          theme: 'light',
          language: 'fr'
        },
        profile: {
          bio: userData.bio || '',
          links: userData.links || [],
          tags: userData.tags || []
        }
      };

      await userDb.put(user);
      set({ currentUser: user, isLoading: false, error: null });
      return user;
    } catch (err) {
      set({ 
        isLoading: false, 
        error: "Échec de la création de l'utilisateur: " + err.message 
      });
      throw err;
    }
  },

  /**
   * Récupère les informations d'un utilisateur
   * @param {string} walletAddress - Adresse du wallet de l'utilisateur
   */
  fetchUserInfo: async (walletAddress) => {
    const { userDb } = useIPFSStore.getState();
    set({ isLoading: true, error: null });
    
    if (!walletAddress) {
      set({ currentUser: null, isLoading: false });
      return;
    }

    try {
      const user = await userDb.get(walletAddress);

      if (user && user.length > 0) {
        const updatedUser = {
          ...user[0],
          lastSeen: Date.now(),
          status: 'online'
        };
        
        await userDb.put(updatedUser);
        set({ 
          currentUser: updatedUser, 
          isLoading: false, 
          error: null 
        });

        // Mettre à jour la liste des utilisateurs en ligne
        get().updateOnlineUsers(updatedUser);
      } else {
        set({ currentUser: null, isLoading: false });
      }
    } catch (err) {
      set({ 
        currentUser: null, 
        isLoading: false,
        error: "Échec de la récupération des informations utilisateur: " + err.message
      });
      console.error("Failed to fetch user:", err);
    }
  },

  /**
   * Met à jour les informations d'un utilisateur
   * @param {Object} userData - Nouvelles données de l'utilisateur
   */
  updateUser: async (userData) => {
    const { userDb } = useIPFSStore.getState();
    const currentUser = get().currentUser;
    set({ isLoading: true, error: null });
    
    try {
      if (!currentUser) {
        throw new Error("Aucun utilisateur connecté");
      }

      const updatedUser = {
        ...currentUser,
        ...userData,
        lastModified: Date.now()
      };

      await userDb.put(updatedUser);
      set({ 
        currentUser: updatedUser, 
        isLoading: false, 
        error: null 
      });
      return updatedUser;
    } catch (err) {
      set({ 
        isLoading: false,
        error: "Échec de la mise à jour de l'utilisateur: " + err.message 
      });
      console.error("Failed to update user:", err);
      throw err;
    }
  },

  /**
   * Déconnecte l'utilisateur
   */
  setUserOffline: async () => {
    const { userDb } = useIPFSStore.getState();
    const currentUser = get().currentUser;
    
    try {
      if (currentUser) {
        const offlineUser = {
          ...currentUser,
          lastSeen: Date.now(),
          status: 'offline'
        };
        
        await userDb.put(offlineUser);
        set({ currentUser: null });
        
        // Mettre à jour la liste des utilisateurs en ligne
        const onlineUsers = new Set(get().onlineUsers);
        onlineUsers.delete(currentUser.id);
        set({ onlineUsers });
      }
    } catch (err) {
      console.error("Failed to set user offline:", err);
      set({ error: "Échec de la déconnexion: " + err.message });
    }
  },

  /**
   * Récupère la liste des utilisateurs
   * @param {Object} options - Options de filtrage
   * @returns {Promise<Array>} Liste des utilisateurs
   */
  fetchUsers: async (options = {}) => {
    const { userDb } = useIPFSStore.getState();
    set({ isLoading: true, error: null });
    
    try {
      let users = await userDb.query((user) => {
        if (options.onlineOnly && user.status !== 'online') {
          return false;
        }
        if (options.search && !user.username.toLowerCase().includes(options.search.toLowerCase())) {
          return false;
        }
        return true;
      });

      set({ isLoading: false, error: null });
      return users;
    } catch (err) {
      set({ 
        isLoading: false,
        error: "Échec de la récupération des utilisateurs: " + err.message 
      });
      console.error("Failed to fetch users:", err);
      return [];
    }
  },

  /**
   * Met à jour la liste des utilisateurs en ligne
   * @param {Object} user - Utilisateur à mettre à jour
   */
  updateOnlineUsers: (user) => {
    const onlineUsers = new Set(get().onlineUsers);
    if (user.status === 'online') {
      onlineUsers.add(user.id);
    } else {
      onlineUsers.delete(user.id);
    }
    set({ onlineUsers });
  },

  /**
   * Bloque un utilisateur
   * @param {string} userId - ID de l'utilisateur à bloquer
   */
  blockUser: async (userId) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;

    try {
      const updatedUser = {
        ...currentUser,
        blocked: [...currentUser.blocked, userId]
      };
      await get().updateUser(updatedUser);
    } catch (err) {
      set({ error: "Échec du blocage de l'utilisateur: " + err.message });
      console.error("Failed to block user:", err);
    }
  },

  /**
   * Débloque un utilisateur
   * @param {string} userId - ID de l'utilisateur à débloquer
   */
  unblockUser: async (userId) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;

    try {
      const updatedUser = {
        ...currentUser,
        blocked: currentUser.blocked.filter(id => id !== userId)
      };
      await get().updateUser(updatedUser);
    } catch (err) {
      set({ error: "Échec du déblocage de l'utilisateur: " + err.message });
      console.error("Failed to unblock user:", err);
    }
  },

  /**
   * Met à jour les préférences de l'utilisateur
   * @param {Object} preferences - Nouvelles préférences
   */
  updatePreferences: async (preferences) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;

    try {
      const updatedUser = {
        ...currentUser,
        preferences: {
          ...currentUser.preferences,
          ...preferences
        }
      };
      await get().updateUser(updatedUser);
    } catch (err) {
      set({ error: "Échec de la mise à jour des préférences: " + err.message });
      console.error("Failed to update preferences:", err);
    }
  },

  /**
   * Réinitialise le store
   */
  resetStore: () => {
    set({
      currentUser: null,
      isLoading: false,
      error: null,
      onlineUsers: new Set()
    });
  }
}));

// Export des types pour TypeScript (si utilisé)
// export type UserStore = ReturnType<typeof useUserStore>;
// export type User = NonNullable<UserStore['currentUser']>;