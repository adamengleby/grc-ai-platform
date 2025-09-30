export interface ConversationInteraction {
  id: string;
  input: {
    message: string;
    files?: any[];
    grcContext?: any;
  };
  output: {
    response: string;
    metadata?: any;
  };
  timestamp: Date;
  reasoning?: string;
  toolsUsed?: string[];
  grcAnalysis?: {
    category?: string;
    riskLevel?: string;
    complianceFrameworks?: string[];
  };
}

export interface MemorySearchResult {
  interaction: ConversationInteraction;
  relevanceScore: number;
  matchedTerms: string[];
}

export class MemoryService {
  private conversations: Map<string, ConversationInteraction[]> = new Map();

  async saveInteraction(userId: string, interaction: Omit<ConversationInteraction, 'id'>): Promise<void> {
    console.log(`💾 Saving GRC conversation interaction for user ${userId}`);

    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }

    const fullInteraction: ConversationInteraction = {
      id: this.generateInteractionId(),
      ...interaction
    };

    this.conversations.get(userId)!.push(fullInteraction);

    // Log GRC-specific context
    if (interaction.grcAnalysis) {
      console.log(`📊 GRC Analysis saved: ${JSON.stringify(interaction.grcAnalysis)}`);
    }
    if (interaction.toolsUsed && interaction.toolsUsed.length > 0) {
      console.log(`🔧 Tools used: ${interaction.toolsUsed.join(', ')}`);
    }
  }

  async getConversationHistory(userId: string, limit: number = 50): Promise<ConversationInteraction[]> {
    console.log(`📜 Retrieving GRC conversation history for user ${userId} (limit: ${limit})`);

    const history = this.conversations.get(userId) || [];
    const recentHistory = history.slice(-limit);

    console.log(`📊 Found ${recentHistory.length} interactions in history`);

    // Log summary of GRC context in recent conversations
    const grcCategories = recentHistory
      .map(h => h.grcAnalysis?.category)
      .filter(Boolean);

    if (grcCategories.length > 0) {
      const categorySummary = this.summarizeArray(grcCategories);
      console.log(`🏢 Recent GRC categories: ${categorySummary}`);
    }

    return recentHistory;
  }

  async searchMemory(userId: string, query: string, limit: number = 10): Promise<MemorySearchResult[]> {
    console.log(`🔍 Searching GRC memory for user ${userId}: "${query}"`);

    const history = this.conversations.get(userId) || [];
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);

    const results: MemorySearchResult[] = [];

    for (const interaction of history) {
      const relevanceScore = this.calculateRelevanceScore(interaction, searchTerms);

      if (relevanceScore > 0) {
        const matchedTerms = this.findMatchedTerms(interaction, searchTerms);
        results.push({
          interaction,
          relevanceScore,
          matchedTerms
        });
      }
    }

    // Sort by relevance score and limit results
    const sortedResults = results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    console.log(`📊 Found ${sortedResults.length} relevant GRC interactions`);

    return sortedResults;
  }

  async getGRCInsights(userId: string): Promise<any> {
    console.log(`📈 Generating GRC insights for user ${userId}`);

    const history = this.conversations.get(userId) || [];

    if (history.length === 0) {
      return {
        totalInteractions: 0,
        message: 'No conversation history available for insights'
      };
    }

    const insights = {
      totalInteractions: history.length,
      timeRange: {
        first: history[0]?.timestamp,
        last: history[history.length - 1]?.timestamp
      },
      grcAnalysis: this.analyzeGRCPatterns(history),
      toolUsage: this.analyzeToolUsage(history),
      topTopics: this.extractTopTopics(history),
      complianceFrameworks: this.extractComplianceFrameworks(history)
    };

    console.log(`✨ Generated insights: ${JSON.stringify(insights, null, 2)}`);

    return insights;
  }

  private generateInteractionId(): string {
    return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRelevanceScore(interaction: ConversationInteraction, searchTerms: string[]): number {
    let score = 0;
    const searchableText = [
      interaction.input.message,
      interaction.output.response,
      interaction.reasoning || '',
      ...(interaction.toolsUsed || []),
      JSON.stringify(interaction.grcAnalysis || {})
    ].join(' ').toLowerCase();

    for (const term of searchTerms) {
      const termOccurrences = (searchableText.match(new RegExp(term, 'g')) || []).length;
      score += termOccurrences;

      // Boost score for GRC-specific terms
      if (this.isGRCTerm(term)) {
        score += termOccurrences * 2;
      }

      // Boost score for exact matches in specific fields
      if (interaction.grcAnalysis?.category?.toLowerCase().includes(term)) {
        score += 5;
      }
      if (interaction.grcAnalysis?.complianceFrameworks?.some(f => f.toLowerCase().includes(term))) {
        score += 3;
      }
    }

    return score;
  }

  private findMatchedTerms(interaction: ConversationInteraction, searchTerms: string[]): string[] {
    const searchableText = [
      interaction.input.message,
      interaction.output.response,
      interaction.reasoning || ''
    ].join(' ').toLowerCase();

    return searchTerms.filter(term => searchableText.includes(term));
  }

  private isGRCTerm(term: string): boolean {
    const grcTerms = [
      'risk', 'compliance', 'audit', 'control', 'governance', 'policy',
      'incident', 'threat', 'vulnerability', 'iso', 'gdpr', 'sox', 'hipaa',
      'framework', 'assessment', 'mitigation', 'effectiveness'
    ];
    return grcTerms.includes(term.toLowerCase());
  }

  private analyzeGRCPatterns(history: ConversationInteraction[]): any {
    const categories = history
      .map(h => h.grcAnalysis?.category)
      .filter(Boolean);

    const riskLevels = history
      .map(h => h.grcAnalysis?.riskLevel)
      .filter(Boolean);

    return {
      mostCommonCategory: this.getMostCommon(categories),
      categoryDistribution: this.getDistribution(categories),
      riskLevelDistribution: this.getDistribution(riskLevels),
      averageToolsPerInteraction: this.calculateAverageToolsUsed(history)
    };
  }

  private analyzeToolUsage(history: ConversationInteraction[]): any {
    const allTools = history
      .flatMap(h => h.toolsUsed || [])
      .filter(Boolean);

    const toolDistribution = this.getDistribution(allTools);
    const totalToolCalls = allTools.length;

    return {
      totalToolCalls,
      uniqueTools: Object.keys(toolDistribution).length,
      mostUsedTool: this.getMostCommon(allTools),
      toolDistribution
    };
  }

  private extractTopTopics(history: ConversationInteraction[]): string[] {
    const allMessages = history
      .map(h => h.input.message)
      .join(' ')
      .toLowerCase();

    // Extract key GRC terms that appear frequently
    const grcKeywords = [
      'risk assessment', 'compliance audit', 'security incident', 'policy review',
      'control effectiveness', 'threat analysis', 'vulnerability management',
      'iso 27001', 'gdpr compliance', 'sox controls', 'data breach'
    ];

    return grcKeywords
      .filter(keyword => allMessages.includes(keyword.toLowerCase()))
      .slice(0, 5);
  }

  private extractComplianceFrameworks(history: ConversationInteraction[]): string[] {
    const allFrameworks = history
      .flatMap(h => h.grcAnalysis?.complianceFrameworks || [])
      .filter(Boolean);

    return [...new Set(allFrameworks)];
  }

  private getMostCommon(items: string[]): string | null {
    if (items.length === 0) return null;

    const distribution = this.getDistribution(items);
    return Object.entries(distribution)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;
  }

  private getDistribution(items: string[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const item of items) {
      distribution[item] = (distribution[item] || 0) + 1;
    }
    return distribution;
  }

  private calculateAverageToolsUsed(history: ConversationInteraction[]): number {
    if (history.length === 0) return 0;

    const totalTools = history
      .map(h => h.toolsUsed?.length || 0)
      .reduce((sum, count) => sum + count, 0);

    return Math.round((totalTools / history.length) * 100) / 100;
  }

  private summarizeArray(items: string[]): string {
    const distribution = this.getDistribution(items);
    return Object.entries(distribution)
      .map(([item, count]) => `${item}(${count})`)
      .join(', ');
  }

  // For future CosmosDB integration
  async persistToDatabase(): Promise<void> {
    console.log('💾 Future: Persisting conversation history to CosmosDB...');
    // TODO: Implement CosmosDB persistence for production
  }

  async loadFromDatabase(userId: string): Promise<void> {
    console.log(`📥 Future: Loading conversation history from CosmosDB for user ${userId}...`);
    // TODO: Implement CosmosDB loading for production
  }
}