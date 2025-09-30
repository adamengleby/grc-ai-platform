export class MemoryService {
  constructor() {
    // Mock implementation - will use CosmosDB in production
    this.conversations = new Map();
  }

  async saveInteraction(userId, interaction) {
    console.log(`💾 Saving interaction for user ${userId}`);
    
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }
    
    this.conversations.get(userId).push({
      id: Date.now(),
      ...interaction
    });
  }

  async getConversationHistory(userId, limit = 50) {
    console.log(`📜 Getting conversation history for user ${userId}`);
    
    const history = this.conversations.get(userId) || [];
    return history.slice(-limit);
  }

  async searchMemory(userId, query, limit = 10) {
    console.log(`🔍 Searching memory for user ${userId}: ${query}`);
    
    const history = this.conversations.get(userId) || [];
    return history.filter(item => 
      JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);
  }
}
