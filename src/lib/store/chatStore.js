import { create } from "zustand";
import { useIPFSStore } from "../config/ipfsStore";
import { useUserStore } from "./userStore";
import { useMessageStore } from "./messageStore";

/**
 * Store Zustand pour la gestion des conversations
 * Intègre la gestion des conversations avec IPFS/OrbitDB
 */
export const useConversationStore = create((set, get) => ({
  // État initial
  conversations: new Map(), // Map of conversationId -> conversation
  currentConversationId: null,
  isLoading: true,
  error: null,
  conversationListeners: new Map(), // Map of conversationId -> cleanup function

  /**
   * Initialise la base de données des conversations
   */
  initDB: async () => {
    const ipfsStore = useIPFSStore.getState();
    
    try {
      if (!ipfsStore.isInitialized) {
        await ipfsStore.initialize();
      }

      // Créer la base de conversations si elle n'existe pas
      const conversationDb = await ipfsStore.orbitdb.docstore('conversations', {
        indexBy: 'id',
        replicate: true
      });
      await conversationDb.load();

      // Stocker conversationDb dans ipfsStore
      await ipfsStore.addDatabase('conversations', conversationDb);
      
      set({ isLoading: false, error: null });
    } catch (err) {
      set({ 
        isLoading: false, 
        error: "Échec de l'initialisation de la base de conversations: " + err.message 
      });
      console.error("Failed to initialize conversation database:", err);
    }
  },

  /**
   * Crée une nouvelle conversation
   * @param {Object} conversationData - Données de la conversation
   * @returns {Promise<Object>} Conversation créée
   */
  createConversation: async (conversationData) => {
    const ipfsStore = useIPFSStore.getState();
    const conversationDb = ipfsStore.databases.get('conversations');
    const currentUser = useUserStore.getState().currentUser;
    
    if (!currentUser) {
      throw new Error("Utilisateur non connecté");
    }

    set({ isLoading: true, error: null });
    
    try {
      const conversation = {
        id: `conv-${Date.now()}-${currentUser.id}`,
        creator: currentUser.id,
        participants: [...new Set([currentUser.id, ...conversationData.participants])],
        type: conversationData.participants.length > 1 ? 'group' : 'direct',
        metadata: {
          name: conversationData.name || null,
          avatar: conversationData.avatar || null,
          description: conversationData.description || null,
          createdAt: Date.now(),
          lastMessage: null,
          lastActivity: Date.now()
        },
        settings: {
          encrypted: conversationData.encrypted || false,
          readReceipts: true,
          notifications: true,
          retention: 30 // jours de rétention des messages
        },
        status: 'active',
        admins: [currentUser.id]
      };

      await conversationDb.put(conversation);
      
      // Mettre à jour les listes de conversations des participants
      for (const participantId of conversation.participants) {
        const participant = await useUserStore.getState().fetchUserInfo(participantId);
        if (participant) {
          await useUserStore.getState().updateUser({
            ...participant,
            conversations: [...(participant.conversations || []), conversation.id]
          });
        }
      }

      // Mettre à jour le cache local
      get().conversations.set(conversation.id, conversation);
      set({ 
        conversations: new Map(get().conversations),
        currentConversationId: conversation.id,
        isLoading: false,
        error: null
      });

      // Configurer les listeners pour cette conversation
      get().setupConversationListeners(conversation.id);

      return conversation;
    } catch (err) {
      set({ 
        isLoading: false,
        error: "Échec de la création de la conversation: " + err.message 
      });
      throw err;
    }
  },

  /**
   * Récupère les conversations d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   */
  fetchUserConversations: async (userId) => {
    const ipfsStore = useIPFSStore.getState();
    const conversationDb = ipfsStore.databases.get('conversations');
    
    set({ isLoading: true, error: null });
    
    try {
      const user = await useUserStore.getState().fetchUserInfo(userId);
      if (!user || !user.conversations) {
        set({ isLoading: false });
        return;
      }

      // Récupérer toutes les conversations
      for (const convId of user.conversations) {
        const conversation = await conversationDb.get(convId);
        if (conversation && conversation.length > 0) {
          // Récupérer le dernier message
          const messages = await useMessageStore.getState().fetchMessages(convId, { limit: 1 });
          const lastMessage = messages[0];

          // Mettre à jour le cache local
          get().conversations.set(convId, {
            ...conversation[0],
            metadata: {
              ...conversation[0].metadata,
              lastMessage
            }
          });
        }
      }

      set({ 
        conversations: new Map(get().conversations),
        isLoading: false,
        error: null
      });

      // Configurer les listeners pour toutes les conversations
      user.conversations.forEach(convId => {
        get().setupConversationListeners(convId);
      });
    } catch (err) {
      set({ 
        isLoading: false,
        error: "Échec de la récupération des conversations: " + err.message 
      });
      console.error("Failed to fetch conversations:", err);
    }
  },

  /**
   * Configure les listeners pour une conversation
   * @param {string} conversationId - ID de la conversation
   */
  setupConversationListeners: (conversationId) => {
    const ipfsStore = useIPFSStore.getState();
    const conversationDb = ipfsStore.databases.get('conversations');
    
    // Nettoyer l'ancien listener s'il existe
    if (get().conversationListeners.has(conversationId)) {
      get().conversationListeners.get(conversationId)();
    }

    // Configurer le nouveau listener
    const cleanup = conversationDb.events.on('write', (address, entry) => {
      const conversation = entry.payload.value;
      if (conversation.id === conversationId) {
        get().conversations.set(conversationId, conversation);
        set({ conversations: new Map(get().conversations) });
      }
    });

    // Stocker la fonction de cleanup
    get().conversationListeners.set(conversationId, cleanup);
  },

  /**
   * Met à jour une conversation
   * @param {string} conversationId - ID de la conversation
   * @param {Object} updates - Mises à jour à appliquer
   */
  updateConversation: async (conversationId, updates) => {
    const ipfsStore = useIPFSStore.getState();
    const conversationDb = ipfsStore.databases.get('conversations');
    const currentUser = useUserStore.getState().currentUser;
    
    try {
      const conversation = get().conversations.get(conversationId);
      
      if (conversation && conversation.admins.includes(currentUser.id)) {
        const updatedConversation = {
          ...conversation,
          ...updates,
          metadata: {
            ...conversation.metadata,
            ...updates.metadata,
            lastActivity: Date.now()
          }
        };

        await conversationDb.put(updatedConversation);

        // Mettre à jour le cache local
        get().conversations.set(conversationId, updatedConversation);
        set({ conversations: new Map(get().conversations) });
      }
    } catch (err) {
      set({ error: "Échec de la mise à jour de la conversation: " + err.message });
      console.error("Failed to update conversation:", err);
    }
  },

  /**
   * Ajoute des participants à une conversation
   * @param {string} conversationId - ID de la conversation
   * @param {Array<string>} participantIds - IDs des participants à ajouter
   */
  addParticipants: async (conversationId, participantIds) => {
    const currentUser = useUserStore.getState().currentUser;
    const conversation = get().conversations.get(conversationId);
    
    if (!conversation || !conversation.admins.includes(currentUser.id)) {
      throw new Error("Permission refusée");
    }

    try {
      const newParticipants = [...new Set([...conversation.participants, ...participantIds])];
      
      await get().updateConversation(conversationId, {
        participants: newParticipants
      });

      // Mettre à jour les listes de conversations des nouveaux participants
      for (const participantId of participantIds) {
        const participant = await useUserStore.getState().fetchUserInfo(participantId);
        if (participant) {
          await useUserStore.getState().updateUser({
            ...participant,
            conversations: [...(participant.conversations || []), conversationId]
          });
        }
      }
    } catch (err) {
      set({ error: "Échec de l'ajout des participants: " + err.message });
      throw err;
    }
  },

  /**
   * Retire des participants d'une conversation
   * @param {string} conversationId - ID de la conversation
   * @param {Array<string>} participantIds - IDs des participants à retirer
   */
  removeParticipants: async (conversationId, participantIds) => {
    const currentUser = useUserStore.getState().currentUser;
    const conversation = get().conversations.get(conversationId);
    
    if (!conversation || !conversation.admins.includes(currentUser.id)) {
      throw new Error("Permission refusée");
    }

    try {
      const remainingParticipants = conversation.participants.filter(
        id => !participantIds.includes(id)
      );
      
      await get().updateConversation(conversationId, {
        participants: remainingParticipants
      });

      // Mettre à jour les listes de conversations des participants retirés
      for (const participantId of participantIds) {
        const participant = await useUserStore.getState().fetchUserInfo(participantId);
        if (participant) {
          await useUserStore.getState().updateUser({
            ...participant,
            conversations: participant.conversations.filter(id => id !== conversationId)
          });
        }
      }
    } catch (err) {
      set({ error: "Échec du retrait des participants: " + err.message });
      throw err;
    }
  },

  /**
   * Quitte une conversation
   * @param {string} conversationId - ID de la conversation
   */
  leaveConversation: async (conversationId) => {
    const currentUser = useUserStore.getState().currentUser;
    
    try {
      await get().removeParticipants(conversationId, [currentUser.id]);
      
      // Supprimer la conversation du cache local
      get().conversations.delete(conversationId);
      set({ 
        conversations: new Map(get().conversations),
        currentConversationId: null 
      });
    } catch (err) {
      set({ error: "Échec de la sortie de la conversation: " + err.message });
      throw err;
    }
  },

  /**
   * Archive une conversation
   * @param {string} conversationId - ID de la conversation
   */
  archiveConversation: async (conversationId) => {
    try {
      await get().updateConversation(conversationId, {
        status: 'archived',
        metadata: {
          archivedAt: Date.now()
        }
      });
    } catch (err) {
      set({ error: "Échec de l'archivage de la conversation: " + err.message });
      throw err;
    }
  },

  /**
   * Supprime une conversation
   * @param {string} conversationId - ID de la conversation
   */
  deleteConversation: async (conversationId) => {
    const currentUser = useUserStore.getState().currentUser;
    const conversation = get().conversations.get(conversationId);
    
    if (!conversation || !conversation.admins.includes(currentUser.id)) {
      throw new Error("Permission refusée");
    }

    try {
      // Marquer la conversation comme supprimée
      await get().updateConversation(conversationId, {
        status: 'deleted',
        metadata: {
          deletedAt: Date.now(),
          deletedBy: currentUser.id
        }
      });

      // Mettre à jour les listes de conversations des participants
      for (const participantId of conversation.participants) {
        const participant = await useUserStore.getState().fetchUserInfo(participantId);
        if (participant) {
          await useUserStore.getState().updateUser({
            ...participant,
            conversations: participant.conversations.filter(id => id !== conversationId)
          });
        }
      }

      // Supprimer du cache local
      get().conversations.delete(conversationId);
      set({ 
        conversations: new Map(get().conversations),
        currentConversationId: null
      });
    } catch (err) {
      set({ error: "Échec de la suppression de la conversation: " + err.message });
      throw err;
    }
  },

  /**
   * Met à jour le dernier message d'une conversation
   * @param {string} conversationId - ID de la conversation
   * @param {Object} message - Dernier message
   */
  updateLastMessage: async (conversationId, message) => {
    try {
      await get().updateConversation(conversationId, {
        metadata: {
          lastMessage: message,
          lastActivity: Date.now()
        }
      });
    } catch (err) {
      console.error("Failed to update last message:", err);
    }
  },

  /**
   * Nettoie les ressources du store
   */
  cleanup: () => {
    // Nettoyer tous les listeners
    get().conversationListeners.forEach(cleanup => cleanup());
    get().conversationListeners.clear();

    set({
      conversations: new Map(),
      currentConversationId: null,
      isLoading: false,
      error: null
    });
  }
}));

