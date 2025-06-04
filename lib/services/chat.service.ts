import { supabase } from '@/lib/database/supabase';
import type { ChatMessage } from '@/lib/database/supabase';

export class ChatService {
  /**
   * Generate embedding for chat message using server-side API
   */
  private async generateMessageEmbedding(content: string): Promise<number[]> {
    try {
      const response = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: content, 
          type: 'chat' 
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('Failed to generate message embedding:', error);
      return new Array(1536).fill(0); // Return zero vector as fallback
    }
  }

  /**
   * Save chat message with AI context and embedding
   */
  async saveChatMessage({
    userId,
    sessionId,
    rocketId,
    role,
    content,
    contextData,
    agentActions,
    tokensUsed
  }: {
    userId: string;
    sessionId: string;
    rocketId?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    contextData?: any;
    agentActions?: any;
    tokensUsed?: number;
  }): Promise<ChatMessage> {
    try {
      // Handle session_id validation to prevent foreign key constraint violations
      let validatedSessionId: string | null = null;
      
      if (sessionId) {
        // Check if this session exists in the database
        const { data: existingSession, error: sessionCheckError } = await supabase
          .from('user_sessions')
          .select('session_id')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingSession && !sessionCheckError) {
          // Session exists in database, safe to use
          validatedSessionId = sessionId;
          console.log('✅ Session exists in database, linking chat message to session:', sessionId);
        } else {
          // Session doesn't exist in database yet, create it
          console.log('⚠️ Session not found in database, creating new session. Session ID:', sessionId);
          
          try {
            const newSessionData = {
              user_id: userId,
              session_id: sessionId,
              started_at: new Date().toISOString(),
              last_activity: new Date().toISOString(),
              metadata: {},
              rocket_count: 0,
              simulation_count: 0
            };

            const { data: newSession, error: createError } = await supabase
              .from('user_sessions')
              .insert(newSessionData)
              .select('session_id')
              .single();

            if (newSession && !createError) {
              validatedSessionId = sessionId;
              console.log('✅ Created new session in database:', sessionId);
            } else {
              console.error('❌ Failed to create session:', createError);
              validatedSessionId = null;
            }
          } catch (createError) {
            console.error('❌ Exception creating session:', createError);
            validatedSessionId = null;
          }
        }
      }

      // If we couldn't validate or create a session, return fallback
      if (!validatedSessionId) {
        console.log('⚠️ No valid session available, returning fallback message');
        return {
          id: `fallback-${Date.now()}`,
          user_id: userId,
          session_id: sessionId,
          rocket_id: rocketId,
          role,
          content,
          context_data: contextData,
          agent_actions: agentActions,
          tokens_used: tokensUsed,
          created_at: new Date().toISOString()
        } as ChatMessage;
      }

      // Handle rocket_id validation to prevent foreign key constraint violations
      let validatedRocketId: string | null = null;
      
      if (rocketId) {
        // Check if this rocket exists in the database
        const { data: existingRocket, error: rocketCheckError } = await supabase
          .from('rockets')
          .select('id')
          .eq('id', rocketId)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingRocket && !rocketCheckError) {
          // Rocket exists in database, safe to use
          validatedRocketId = rocketId;
          console.log('✅ Rocket exists in database, linking chat message to rocket:', rocketId);
        } else {
          // Rocket doesn't exist in database yet
          console.log('⚠️ Rocket not found in database, saving chat message without rocket link. Rocket ID:', rocketId);
          console.log('   This is normal for new/unsaved rocket designs.');
          validatedRocketId = null;
        }
      }

      // Generate embedding for semantic search
      const embedding = await this.generateMessageEmbedding(content);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: userId,
          session_id: validatedSessionId, // Use validated session_id
          rocket_id: validatedRocketId, // Use validated rocket_id or null
          role,
          content,
          context_data: contextData,
          agent_actions: agentActions,
          tokens_used: tokensUsed,
          message_vector: embedding, // Store the embedding
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error saving chat message:', error);
      // Return a fallback message structure for graceful degradation
      return {
        id: `fallback-${Date.now()}`,
        user_id: userId,
        session_id: sessionId,
        rocket_id: rocketId,
        role,
        content,
        context_data: contextData,
        agent_actions: agentActions,
        tokens_used: tokensUsed,
        created_at: new Date().toISOString()
      } as ChatMessage;
    }
  }

  /**
   * Get chat history for a session
   */
  async getChatHistory(sessionId: string, limit = 50): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching chat history:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Chat history fetch failed:', error);
      return [];
    }
  }

  /**
   * Search chat messages by semantic similarity using server-side API
   */
  async searchMessages(
    query: string, 
    userId: string, 
    limit = 10
  ): Promise<{
    message: ChatMessage;
    similarity: number;
  }[]> {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await this.generateMessageEmbedding(query);
      
      // Get recent messages to search through
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100); // Get more messages to search through
      
      if (error) throw error;
      
      // Filter messages that have embeddings
      const messagesWithEmbeddings = (data || []).filter(msg => 
        msg.message_vector && Array.isArray(msg.message_vector)
      );
      
      if (messagesWithEmbeddings.length === 0) {
        // Fallback to text search if no embeddings available
        return this.searchMessagesByText(query, userId, limit);
      }
      
      // Prepare vectors for similarity calculation
      const vectors = messagesWithEmbeddings.map(msg => ({
        vector: msg.message_vector,
        data: msg,
        id: msg.id
      }));
      
      // Calculate similarities using server-side API
      const similarityResponse = await fetch('/api/similarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryVector: queryEmbedding,
          vectors,
          method: 'cosine',
          threshold: 0.7,
          limit
        })
      });
      
      if (!similarityResponse.ok) {
        throw new Error(`Similarity API error: ${similarityResponse.status}`);
      }
      
      const similarityData = await similarityResponse.json();
      
      // Return formatted results
      return similarityData.results.map((result: any) => ({
        message: result.data,
        similarity: result.similarity
      }));
        
    } catch (error) {
      console.error('Error searching messages by similarity:', error);
      // Fallback to text search
      return this.searchMessagesByText(query, userId, limit);
    }
  }

  /**
   * Fallback text search for messages
   */
  private async searchMessagesByText(
    query: string, 
    userId: string, 
    limit = 10
  ): Promise<{ message: ChatMessage; similarity: number; }[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // Return with basic text similarity scoring
      return (data || []).map(message => ({
        message,
        similarity: this.calculateTextSimilarity(query, message.content)
      }));
        
    } catch (error) {
      console.error('Error in text search fallback:', error);
      return [];
    }
  }

  /**
   * Basic text similarity calculation (Jaccard similarity)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Get chat context for AI conversations
   */
  async getChatContext(
    sessionId: string, 
    messageCount = 10
  ): Promise<{
    role: string;
    content: string;
  }[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(messageCount);
      
      if (error) throw error;
      
      // Return in chronological order
      return (data || []).reverse();
    } catch (error) {
      console.error('Error fetching chat context:', error);
      return [];
    }
  }

  /**
   * Find similar conversations using semantic search
   */
  async findSimilarConversations(
    query: string, 
    userId: string, 
    limit = 5
  ): Promise<{
    sessionId: string;
    similarity: number;
    snippet: string;
    messageCount: number;
  }[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateMessageEmbedding(query);
      
      // Get recent sessions with their representative messages
      const { data, error } = await supabase
        .from('chat_messages')
        .select('session_id, content, message_vector, created_at')
        .eq('user_id', userId)
        .eq('role', 'user') // Focus on user messages for session representation
        .not('message_vector', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200); // Get messages from recent sessions
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // Group messages by session and find representative message per session
      const sessionMap = new Map<string, {
        messages: any[];
        bestMessage?: any;
        similarity?: number;
      }>();
      
      data.forEach(msg => {
        if (!sessionMap.has(msg.session_id || '')) {
          sessionMap.set(msg.session_id || '', { messages: [] });
        }
        sessionMap.get(msg.session_id || '')!.messages.push(msg);
      });
      
      // Calculate similarity for representative message from each session
      const sessionVectors = Array.from(sessionMap.entries()).map(([sessionId, sessionData]) => {
        // Use the most recent user message as representative
        const representative = sessionData.messages[0];
        return {
          vector: representative.message_vector,
          data: {
            sessionId,
            representative,
            messageCount: sessionData.messages.length
          },
          id: sessionId
        };
      });
      
      // Calculate similarities
      const similarityResponse = await fetch('/api/similarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryVector: queryEmbedding,
          vectors: sessionVectors,
          method: 'cosine',
          threshold: 0.5, // Lower threshold for session similarity
          limit
        })
      });
      
      if (!similarityResponse.ok) {
        throw new Error(`Similarity API error: ${similarityResponse.status}`);
      }
      
      const similarityData = await similarityResponse.json();
      
      // Format results
      return similarityData.results.map((result: any) => ({
        sessionId: result.data.sessionId,
        similarity: result.similarity,
        snippet: result.data.representative.content.substring(0, 150) + '...',
        messageCount: result.data.messageCount
      }));
      
    } catch (error) {
      console.error('Error finding similar conversations:', error);
      return [];
    }
  }

  /**
   * Get user session stats
   */
  async getSessionStats(sessionId: string): Promise<{
    messageCount: number;
    tokensUsed: number;
    rocketCount: number;
    simulationCount: number;
  }> {
    try {
      // Get session data
      const { data, error } = await supabase
        .from('user_sessions')
        .select('rocket_count, simulation_count')
        .eq('session_id', sessionId)
        .single();
      
      // Get message stats
      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .select('tokens_used')
        .eq('session_id', sessionId);
      
      const messageCount = messageData?.length || 0;
      const tokensUsed = messageData?.reduce((sum, msg) => sum + (msg.tokens_used || 0), 0) || 0;
      
      return {
        messageCount,
        tokensUsed,
        rocketCount: data?.rocket_count || 0,
        simulationCount: data?.simulation_count || 0
      };
    } catch (error) {
      console.error('Error fetching session stats:', error);
      return {
        messageCount: 0,
        tokensUsed: 0,
        rocketCount: 0,
        simulationCount: 0
      };
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('session_id', sessionId);
    } catch (error) {
      console.warn('Could not update session activity:', error);
    }
  }

  /**
   * Get conversation summary for a session
   */
  async getConversationSummary(sessionId: string): Promise<{
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    topics: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
  }> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId);
      
      if (error) throw error;
      
      const messages = data || [];
      const userMessages = messages.filter(m => m.role === 'user').length;
      const assistantMessages = messages.filter(m => m.role === 'assistant').length;
      
      // Extract topics from message content
      const topics: string[] = [];
      const keywords = [
        'rocket', 'simulation', 'altitude', 'velocity', 'motor', 'fins', 
        'nose', 'stability', 'drag', 'thrust', 'recovery', 'parachute',
        'design', 'optimization', 'performance', 'trajectory', 'launch'
      ];
      
      messages.forEach(msg => {
        keywords.forEach(keyword => {
          if (msg.content.toLowerCase().includes(keyword) && !topics.includes(keyword)) {
            topics.push(keyword);
          }
        });
      });
      
      // Basic sentiment analysis
      const userContent = messages
        .filter(m => m.role === 'user')
        .map(m => m.content.toLowerCase())
        .join(' ');
      
      const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'love', 'like'];
      const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'problem', 'issue', 'error'];
      
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      const positiveCount = positiveWords.filter(word => userContent.includes(word)).length;
      const negativeCount = negativeWords.filter(word => userContent.includes(word)).length;
      
      if (positiveCount > negativeCount) sentiment = 'positive';
      else if (negativeCount > positiveCount) sentiment = 'negative';
      
      return {
        messageCount: messages.length,
        userMessages,
        assistantMessages,
        topics: topics.slice(0, 8), // Top 8 topics
        sentiment
      };
    } catch (error) {
      console.error('Error generating conversation summary:', error);
      return {
        messageCount: 0,
        userMessages: 0,
        assistantMessages: 0,
        topics: [],
        sentiment: 'neutral'
      };
    }
  }

  /**
   * Get chat insights using embeddings
   */
  async getChatInsights(userId: string, timeframe = 30): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageSessionLength: number;
    topTopics: { topic: string; count: number; }[];
    conversationTrends: { date: string; count: number; }[];
  }> {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - timeframe);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('session_id, content, created_at')
        .eq('user_id', userId)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const messages = data || [];
      const sessions = new Set(messages.map(m => m.session_id));
      
      // Calculate insights
      const totalConversations = sessions.size;
      const totalMessages = messages.length;
      const averageSessionLength = totalConversations > 0 ? totalMessages / totalConversations : 0;
      
      // Extract topic frequency
      const topicCounts = new Map<string, number>();
      const keywords = [
        'rocket', 'simulation', 'altitude', 'velocity', 'motor', 'fins', 
        'nose', 'stability', 'drag', 'thrust', 'recovery', 'design'
      ];
      
      messages.forEach(msg => {
        keywords.forEach(keyword => {
          if (msg.content.toLowerCase().includes(keyword)) {
            topicCounts.set(keyword, (topicCounts.get(keyword) || 0) + 1);
          }
        });
      });
      
      const topTopics = Array.from(topicCounts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Conversation trends by day
      const trendMap = new Map<string, number>();
      messages.forEach(msg => {
        const date = msg.created_at ? new Date(msg.created_at).toISOString().split('T')[0] : '';
        if (date) {
          trendMap.set(date, (trendMap.get(date) || 0) + 1);
        }
      });
      
      const conversationTrends = Array.from(trendMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      return {
        totalConversations,
        totalMessages,
        averageSessionLength,
        topTopics,
        conversationTrends
      };
      
    } catch (error) {
      console.error('Error generating chat insights:', error);
      return {
        totalConversations: 0,
        totalMessages: 0,
        averageSessionLength: 0,
        topTopics: [],
        conversationTrends: []
      };
    }
  }

  /**
   * Get chat history for a specific rocket/project
   */
  async getChatHistoryByRocket(rocketId: string, limit = 50): Promise<ChatMessage[]> {
    try {
      console.log('🔍 Fetching chat history for rocket:', rocketId);
      
      // Try with inner join first
      const { data: innerJoinData, error: innerJoinError } = await supabase
        .from('chat_messages')
        .select(`
          *,
          user_sessions!inner(session_id)
        `)
        .eq('rocket_id', rocketId)
        .order('created_at', { ascending: true })
        .limit(limit);
      
      if (innerJoinData && innerJoinData.length > 0) {
        console.log('🔍 Found', innerJoinData.length, 'messages with inner join');
        return innerJoinData;
      }
      
      // If inner join doesn't work, try without the join
      const { data: simpleData, error: simpleError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('rocket_id', rocketId)
        .order('created_at', { ascending: true })
        .limit(limit);
      
      if (simpleError) {
        console.error('Error fetching chat history by rocket (simple query):', simpleError);
        return [];
      }
      
      console.log('🔍 Found', simpleData?.length || 0, 'messages with simple query');
      return simpleData || [];
    } catch (error) {
      console.error('Chat history by rocket fetch failed:', error);
      return [];
    }
  }

  /**
   * Get all sessions associated with a specific rocket
   */
  async getSessionsByRocket(rocketId: string): Promise<string[]> {
    try {
      console.log('🔍 Searching for sessions associated with rocket:', rocketId);
      
      // First, try to find messages directly linked to the rocket
      const { data: directMessages, error: directError } = await supabase
        .from('chat_messages')
        .select('session_id')
        .eq('rocket_id', rocketId)
        .order('created_at', { ascending: false });
      
      if (directError) {
        console.error('Error fetching direct messages by rocket:', directError);
      }
      
      const directSessionIds = new Set(directMessages?.map(row => row.session_id).filter(Boolean) || []);
      console.log('🔍 Found', directSessionIds.size, 'sessions with direct rocket links');
      
      // Also search for messages that might reference this rocket ID in content or context
      const { data: contextMessages, error: contextError } = await supabase
        .from('chat_messages')
        .select('session_id, context_data, content')
        .or(`context_data->rocketId.eq.${rocketId},content.ilike.%${rocketId}%`)
        .order('created_at', { ascending: false });
      
      if (contextError) {
        console.error('Error fetching context messages:', contextError);
      }
      
      const contextSessionIds = new Set(contextMessages?.map(row => row.session_id).filter(Boolean) || []);
      console.log('🔍 Found', contextSessionIds.size, 'additional sessions with rocket references in context');
      
      // Combine all session IDs
      const allSessionIds = Array.from(new Set([...Array.from(directSessionIds), ...Array.from(contextSessionIds)]));
      console.log('🔍 Total unique sessions found:', allSessionIds.length);
      
      return allSessionIds;
    } catch (error) {
      console.error('Sessions by rocket fetch failed:', error);
      return [];
    }
  }
}

export const chatService = new ChatService(); 