// conversationStore.js
let conversationDb;

const initConversationDB = async () => {
  try {
    const orbitdb = await OrbitDB.createInstance(window.ipfs);
    conversationDb = await orbitdb.docstore('conversations', {
      indexBy: 'id',
      replicate: true
    });
    await conversationDb.load();
    return conversationDb;
  } catch (err) {
    console.error("Failed to initialize conversation DB:", err);
    throw err;
  }
};

export const useChatStore = create((set) => ({
  currentConversation: null,
  conversations: [],
  isLoading: true,

  initConversationDB: async () => {
    try {
      await initConversationDB();
      set({ isLoading: false });
    } catch (err) {
      console.error("Failed to initialize conversation database:", err);
      set({ isLoading: false });
    }
  },

  createConversation: async (participants) => {
    try {
      const conversation = {
        id: `conv-${Date.now()}`,
        participants,
        createdAt: Date.now(),
        lastMessage: null,
        type: participants.length > 2 ? 'group' : 'direct'
      };

      await conversationDb.put(conversation);
      
      // Update users' conversation lists
      for (const participantId of participants) {
        const user = await userDb.get(participantId);
        if (user && user.length > 0) {
          const userData = user[0];
          await userDb.put({
            ...userData,
            conversations: [...(userData.conversations || []), conversation.id]
          });
        }
      }

      return conversation;
    } catch (err) {
      console.error("Failed to create conversation:", err);
      throw err;
    }
  },

  fetchUserConversations: async (userId) => {
    try {
      const user = await userDb.get(userId);
      if (user && user.length > 0 && user[0].conversations) {
        const conversations = [];
        for (const convId of user[0].conversations) {
          const conv = await conversationDb.get(convId);
          if (conv && conv.length > 0) {
            conversations.push(conv[0]);
          }
        }
        set({ conversations });
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  }
}));