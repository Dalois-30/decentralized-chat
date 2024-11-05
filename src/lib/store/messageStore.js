import { create } from "zustand";
import { useIPFSStore } from "../config/ipfsStore";
import { useUserStore } from "./userStore";

/**
 * Store Zustand pour la gestion des messages
 * Intègre la gestion des messages avec IPFS/OrbitDB
 */
export const useMessageStore = create((set, get) => ({
  // État initial
  messages: new Map(), // Map of conversationId -> messages[]
  isLoading: true,
  error: null,
  activeConversationId: null,
  messageListeners: new Map(), // Map of conversationId -> cleanup function
  
  /**
   * Initialise la base de données des messages
   */
  initDB: async () => {
    const ipfsStore = useIPFSStore.getState();
    
    try {
      if (!ipfsStore.isInitialized) {
        await ipfsStore.initialize();
      }

      // Créer la base de messages si elle n'existe pas
      const messageDb = await ipfsStore.orbitdb.feed('messages', {
        accessController: {
          write: ['*'] // Tous les utilisateurs peuvent écrire
        },
        replicate: true
      });
      await messageDb.load();

      // Stocker messageDb dans ipfsStore
      await ipfsStore.addDatabase('messages', messageDb);
      
      set({ isLoading: false, error: null });
    } catch (err) {
      set({ 
        isLoading: false, 
        error: "Échec de l'initialisation de la base de messages: " + err.message 
      });
      console.error("Failed to initialize message database:", err);
    }
  },

  /**
   * Envoie un nouveau message
   * @param {Object} messageData - Données du message
   * @returns {Promise<Object>} Message envoyé
   */
  sendMessage: async (messageData) => {
    const ipfsStore = useIPFSStore.getState();
    const messageDb = ipfsStore.databases.get('messages');
    const currentUser = useUserStore.getState().currentUser;
    
    if (!currentUser) {
      throw new Error("Utilisateur non connecté");
    }

    set({ isLoading: true, error: null });
    
    try {
      const message = {
        id: `${Date.now()}-${currentUser.id}`,
        sender: currentUser.id,
        conversationId: messageData.conversationId,
        content: messageData.content,
        timestamp: Date.now(),
        status: 'sent',
        type: messageData.type || 'text',
        metadata: {
          reactions: [],
          repliedTo: messageData.repliedTo || null,
          attachments: messageData.attachments || [],
          mentions: messageData.mentions || []
        },
        encrypted: messageData.encrypted || false
      };

      // Chiffrer le message si nécessaire
      if (message.encrypted) {
        message.content = await get().encryptMessage(message.content, message.conversationId);
      }

      const hash = await messageDb.add(message);
      
      // Mettre à jour le cache local
      const conversationMessages = get().messages.get(message.conversationId) || [];
      conversationMessages.push({ ...message, hash });
      get().messages.set(message.conversationId, conversationMessages);
      
      set({ 
        messages: new Map(get().messages),
        isLoading: false,
        error: null
      });

      return message;
    } catch (err) {
      set({ 
        isLoading: false,
        error: "Échec de l'envoi du message: " + err.message 
      });
      throw err;
    }
  },

  /**
   * Récupère les messages d'une conversation
   * @param {string} conversationId - ID de la conversation
   * @param {Object} options - Options de pagination et de filtrage
   */
  fetchMessages: async (conversationId, options = {}) => {
    const ipfsStore = useIPFSStore.getState();
    const messageDb = ipfsStore.databases.get('messages');
    
    set({ isLoading: true, error: null });
    
    try {
      // Récupérer les messages avec pagination
      const limit = options.limit || 50;
      const messages = await messageDb.iterator({ limit })
        .collect()
        .map(entry => ({
          ...entry.payload.value,
          hash: entry.hash
        }))
        .filter(message => message.conversationId === conversationId);

      // Trier les messages par timestamp
      const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Déchiffrer les messages si nécessaire
      const decryptedMessages = await Promise.all(
        sortedMessages.map(async message => {
          if (message.encrypted) {
            message.content = await get().decryptMessage(message.content, conversationId);
          }
          return message;
        })
      );

      // Mettre à jour le cache local
      get().messages.set(conversationId, decryptedMessages);
      
      set({ 
        messages: new Map(get().messages),
        activeConversationId: conversationId,
        isLoading: false,
        error: null
      });

      // Configurer les listeners pour les nouveaux messages
      get().setupMessageListeners(conversationId);
    } catch (err) {
      set({ 
        isLoading: false,
        error: "Échec de la récupération des messages: " + err.message 
      });
      console.error("Failed to fetch messages:", err);
    }
  },

  /**
   * Configure les listeners pour les nouveaux messages
   * @param {string} conversationId - ID de la conversation
   */
  setupMessageListeners: (conversationId) => {
    const ipfsStore = useIPFSStore.getState();
    const messageDb = ipfsStore.databases.get('messages');
    
    // Nettoyer l'ancien listener s'il existe
    if (get().messageListeners.has(conversationId)) {
      get().messageListeners.get(conversationId)();
    }

    // Configurer le nouveau listener
    const cleanup = messageDb.events.on('write', async (address, entry) => {
      const message = entry.payload.value;
      if (message.conversationId === conversationId) {
        const messages = get().messages.get(conversationId) || [];
        
        // Déchiffrer si nécessaire
        if (message.encrypted) {
          message.content = await get().decryptMessage(message.content, conversationId);
        }
        
        messages.push({ ...message, hash: entry.hash });
        get().messages.set(conversationId, messages.sort((a, b) => a.timestamp - b.timestamp));
        set({ messages: new Map(get().messages) });
      }
    });

    // Stocker la fonction de cleanup
    get().messageListeners.set(conversationId, cleanup);
  },

  /**
   * Supprime un message
   * @param {string} messageId - ID du message
   * @param {string} conversationId - ID de la conversation
   */
  deleteMessage: async (messageId, conversationId) => {
    const ipfsStore = useIPFSStore.getState();
    const messageDb = ipfsStore.databases.get('messages');
    const currentUser = useUserStore.getState().currentUser;
    
    try {
      const messages = get().messages.get(conversationId) || [];
      const message = messages.find(m => m.id === messageId);
      
      if (message && message.sender === currentUser.id) {
        await messageDb.add({
          ...message,
          deleted: true,
          deletedAt: Date.now(),
          deletedBy: currentUser.id
        });

        // Mettre à jour le cache local
        const updatedMessages = messages.filter(m => m.id !== messageId);
        get().messages.set(conversationId, updatedMessages);
        set({ messages: new Map(get().messages) });
      }
    } catch (err) {
      set({ error: "Échec de la suppression du message: " + err.message });
      console.error("Failed to delete message:", err);
    }
  },

  /**
   * Modifie un message
   * @param {string} messageId - ID du message
   * @param {string} newContent - Nouveau contenu
   * @param {string} conversationId - ID de la conversation
   */
  editMessage: async (messageId, newContent, conversationId) => {
    const ipfsStore = useIPFSStore.getState();
    const messageDb = ipfsStore.databases.get('messages');
    const currentUser = useUserStore.getState().currentUser;
    
    try {
      const messages = get().messages.get(conversationId) || [];
      const message = messages.find(m => m.id === messageId);
      
      if (message && message.sender === currentUser.id) {
        const updatedMessage = {
          ...message,
          content: newContent,
          edited: true,
          editedAt: Date.now(),
          editedBy: currentUser.id
        };

        // Chiffrer si nécessaire
        if (message.encrypted) {
          updatedMessage.content = await get().encryptMessage(newContent, conversationId);
        }

        await messageDb.add(updatedMessage);

        // Mettre à jour le cache local
        const messageIndex = messages.findIndex(m => m.id === messageId);
        messages[messageIndex] = updatedMessage;
        get().messages.set(conversationId, messages);
        set({ messages: new Map(get().messages) });
      }
    } catch (err) {
      set({ error: "Échec de la modification du message: " + err.message });
      console.error("Failed to edit message:", err);
    }
  },

  /**
   * Ajoute une réaction à un message
   * @param {string} messageId - ID du message
   * @param {string} reaction - Emoji de réaction
   * @param {string} conversationId - ID de la conversation
   */
  addReaction: async (messageId, reaction, conversationId) => {
    const ipfsStore = useIPFSStore.getState();
    const messageDb = ipfsStore.databases.get('messages');
    const currentUser = useUserStore.getState().currentUser;
    
    try {
      const messages = get().messages.get(conversationId) || [];
      const message = messages.find(m => m.id === messageId);
      
      if (message) {
        const updatedMessage = {
          ...message,
          metadata: {
            ...message.metadata,
            reactions: [
              ...message.metadata.reactions,
              {
                emoji: reaction,
                userId: currentUser.id,
                timestamp: Date.now()
              }
            ]
          }
        };

        await messageDb.add(updatedMessage);

        // Mettre à jour le cache local
        const messageIndex = messages.findIndex(m => m.id === messageId);
        messages[messageIndex] = updatedMessage;
        get().messages.set(conversationId, messages);
        set({ messages: new Map(get().messages) });
      }
    } catch (err) {
      set({ error: "Échec de l'ajout de la réaction: " + err.message });
      console.error("Failed to add reaction:", err);
    }
  },

  /**
   * Marque les messages comme lus
   * @param {string} conversationId - ID de la conversation
   */
  markAsRead: async (conversationId) => {
    const ipfsStore = useIPFSStore.getState();
    const messageDb = ipfsStore.databases.get('messages');
    const currentUser = useUserStore.getState().currentUser;
    
    try {
      const messages = get().messages.get(conversationId) || [];
      const unreadMessages = messages.filter(
        m => m.sender !== currentUser.id && !m.readBy?.includes(currentUser.id)
      );

      for (const message of unreadMessages) {
        const updatedMessage = {
          ...message,
          readBy: [...(message.readBy || []), currentUser.id]
        };

        await messageDb.add(updatedMessage);

        // Mettre à jour le cache local
        const messageIndex = messages.findIndex(m => m.id === message.id);
        messages[messageIndex] = updatedMessage;
      }

      get().messages.set(conversationId, messages);
      set({ messages: new Map(get().messages) });
    } catch (err) {
      set({ error: "Échec du marquage des messages comme lus: " + err.message });
      console.error("Failed to mark messages as read:", err);
    }
  },

  /**
   * Chiffre un message
   * @param {string} content - Contenu à chiffrer
   * @param {string} conversationId - ID de la conversation
   * @returns {Promise<string>} Contenu chiffré
   */
  encryptMessage: async (content, conversationId) => {
    // Implémentez votre logique de chiffrement ici
    return content;
  },

  /**
   * Déchiffre un message
   * @param {string} content - Contenu à déchiffrer
   * @param {string} conversationId - ID de la conversation
   * @returns {Promise<string>} Contenu déchiffré
   */
  decryptMessage: async (content, conversationId) => {
    // Implémentez votre logique de déchiffrement ici
    return content;
  },

  /**
   * Nettoie les ressources du store
   */
  cleanup: () => {
    // Nettoyer tous les listeners
    get().messageListeners.forEach(cleanup => cleanup());
    get().messageListeners.clear();

    set({
      messages: new Map(),
      isLoading: false,
      error: null,
      activeConversationId: null
    });
  }
}));

