// messageStore.js
let messageDb;

const initMessageDB = async () => {
  try {
    const orbitdb = await OrbitDB.createInstance(window.ipfs);
    messageDb = await orbitdb.feed('messages', {
      replicate: true
    });
    await messageDb.load();
    return messageDb;
  } catch (err) {
    console.error("Failed to initialize message DB:", err);
    throw err;
  }
};

export const useMessageStore = create((set, get) => ({
  messages: [],
  isLoading: true,
  
  initMessageDB: async () => {
    try {
      const db = await initMessageDB();
      // Subscribe to new messages
      db.events.on('write', (address, entry) => {
        const messages = get().messages;
        messages.push(entry.payload.value);
        set({ messages: [...messages] });
      });
      set({ isLoading: false });
    } catch (err) {
      console.error("Failed to initialize message database:", err);
      set({ isLoading: false });
    }
  },

  sendMessage: async (content, conversationId) => {
    try {
      const currentUser = useUserStore.getState().currentUser;
      
      const message = {
        id: `${Date.now()}-${currentUser.id}`,
        sender: currentUser.id,
        conversationId,
        content,
        timestamp: Date.now(),
        status: 'sent',
        type: 'text', // Could be 'text', 'image', 'file', etc.
        reactions: [],
        repliedTo: null
      };

      await messageDb.add(message);
      return message;
    } catch (err) {
      console.error("Failed to send message:", err);
      throw err;
    }
  },

  fetchMessages: async (conversationId) => {
    try {
      const messages = await messageDb.iterator({ limit: -1 })
        .collect()
        .map(entry => entry.payload.value)
        .filter(message => message.conversationId === conversationId);

      set({ messages: messages.sort((a, b) => a.timestamp - b.timestamp) });
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  },

  deleteMessage: async (messageId) => {
    try {
      // Note: In OrbitDB, we can't actually delete entries
      // Instead, we mark them as deleted
      const message = get().messages.find(m => m.id === messageId);
      if (message) {
        await messageDb.add({
          ...message,
          deleted: true,
          deletedAt: Date.now()
        });
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  },

  editMessage: async (messageId, newContent) => {
    try {
      const message = get().messages.find(m => m.id === messageId);
      if (message) {
        await messageDb.add({
          ...message,
          content: newContent,
          edited: true,
          editedAt: Date.now()
        });
      }
    } catch (err) {
      console.error("Failed to edit message:", err);
    }
  }
}));