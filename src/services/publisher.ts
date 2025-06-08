import { randomUUID } from 'crypto';
import database from '../database';
import twitterService from './twitter';
import nostrService from './nostr';
import { encrypt, decrypt } from '../utils/crypto';
import { Post, PublicationLog } from '../types';

class PublisherService {
  // Publica simultaneamente no Twitter e Nostr
  async publishPost(
    userId: string,
    content: string,
    mediaUrls?: string[]
  ): Promise<{ postId: string; results: { twitter?: any; nostr?: any } }> {
    const postId = randomUUID();
    
    // Cria o post no banco
    const post: Post = {
      id: postId,
      userId,
      content,
      mediaUrls,
      createdAt: new Date(),
      status: 'pending'
    };
    
    await database.createPost(post);

    // Busca as credenciais do usuário
    const user = await database.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const results: { twitter?: any; nostr?: any } = {};
    let hasSuccess = false;
    let hasFailure = false;

    // Publica no Twitter se o usuário tem tokens
    if (user.twitterAccessToken && user.twitterAccessSecret) {
      try {
        const decryptedAccessToken = decrypt(user.twitterAccessToken);
        const decryptedAccessSecret = decrypt(user.twitterAccessSecret);
        
        const twitterResult = await twitterService.publishTweet(
          decryptedAccessToken,
          decryptedAccessSecret,
          content,
          mediaUrls
        );

        results.twitter = twitterResult;

        // Log da publicação
        const logId = randomUUID();
        const log: PublicationLog = {
          id: logId,
          postId,
          platform: 'twitter',
          status: twitterResult.success ? 'success' : 'failed',
          error: twitterResult.error,
          publishedAt: new Date(),
          platformPostId: twitterResult.tweetId
        };
        
        await database.createPublicationLog(log);

        if (twitterResult.success) {
          hasSuccess = true;
        } else {
          hasFailure = true;
        }
      } catch (error: any) {
        results.twitter = { success: false, error: error.message };
        hasFailure = true;

        // Log do erro
        const logId = randomUUID();
        const log: PublicationLog = {
          id: logId,
          postId,
          platform: 'twitter',
          status: 'failed',
          error: error.message,
          publishedAt: new Date()
        };
        
        await database.createPublicationLog(log);
      }
    }

    // Publica no Nostr se o usuário tem chave privada
    if (user.nostrPrivateKey) {
      try {
        const decryptedPrivateKey = decrypt(user.nostrPrivateKey);
        
        const nostrResult = await nostrService.publishNote(
          decryptedPrivateKey,
          content,
          mediaUrls
        );

        results.nostr = nostrResult;

        // Log da publicação
        const logId = randomUUID();
        const log: PublicationLog = {
          id: logId,
          postId,
          platform: 'nostr',
          status: nostrResult.success ? 'success' : 'failed',
          error: nostrResult.error,
          publishedAt: new Date(),
          platformPostId: nostrResult.eventId
        };
        
        await database.createPublicationLog(log);

        if (nostrResult.success) {
          hasSuccess = true;
        } else {
          hasFailure = true;
        }
      } catch (error: any) {
        results.nostr = { success: false, error: error.message };
        hasFailure = true;

        // Log do erro
        const logId = randomUUID();
        const log: PublicationLog = {
          id: logId,
          postId,
          platform: 'nostr',
          status: 'failed',
          error: error.message,
          publishedAt: new Date()
        };
        
        await database.createPublicationLog(log);
      }
    }

    // Atualiza o status do post
    let finalStatus: Post['status'];
    if (hasSuccess && !hasFailure) {
      finalStatus = 'published';
    } else if (hasSuccess && hasFailure) {
      finalStatus = 'partial';
    } else {
      finalStatus = 'failed';
    }

    await database.updatePostStatus(postId, finalStatus);

    return { postId, results };
  }

  // Busca os logs de uma publicação
  async getPublicationLogs(postId: string): Promise<PublicationLog[]> {
    return database.getPublicationLogsByPostId(postId);
  }

  // Busca um post por ID
  async getPost(postId: string): Promise<Post | null> {
    return database.getPostById(postId);
  }
}

export default new PublisherService(); 