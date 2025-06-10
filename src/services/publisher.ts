import database from '../database';
import xService from './x';
import nostrService from './nostr';
import { User, Post, PublicationLog } from '../types';
import { randomUUID } from 'crypto';
import { decrypt } from '../utils/crypto';

// Publica simultaneamente no X e Nostr
export async function publishPost(
  user: User,
  content: string,
  mediaUrls?: string[]
): Promise<{ postId: string; results: { x?: any; nostr?: any } }> {
  
  // Cria o post no banco
  const postId = randomUUID();
  const post: Post = {
    id: postId,
    userId: user.id,
    content,
    mediaUrls,
    createdAt: new Date(),
    status: 'pending'
  };
  
  await database.createPost(post);
  
  const results: { x?: any; nostr?: any } = {};
  
  try {
    // Publica no X se o usuário tem credenciais
    if (user.xAccessToken && user.xAccessSecret) {
      try {
        const xResult = await xService.publishPost(
          decrypt(user.xAccessToken),
          decrypt(user.xAccessSecret),
          content,
          mediaUrls
        );
        
        results.x = xResult;
        
        // Log de sucesso/erro
        await database.createPublicationLog({
          id: randomUUID(),
          postId,
          platform: 'x',
          status: xResult.success ? 'success' : 'failed',
          error: xResult.error,
          publishedAt: new Date(),
          platformPostId: xResult.postId
        });
        
      } catch (error: any) {
        console.error('Erro ao publicar no X:', error);
        results.x = { success: false, error: error.message };
        
        // Log de erro
        await database.createPublicationLog({
          id: randomUUID(),
          postId,
          platform: 'x',
          status: 'failed',
          error: error.message,
          publishedAt: new Date()
        });
      }
    }
    
    // Publica no Nostr se o usuário tem chave privada
    if (user.nostrPrivateKey) {
      try {
        const nostrResult = await nostrService.publishNote(
          decrypt(user.nostrPrivateKey),
          content,
          mediaUrls
        );
        
        results.nostr = nostrResult;
        
        // Log de sucesso/erro
        await database.createPublicationLog({
          id: randomUUID(),
          postId,
          platform: 'nostr',
          status: nostrResult.success ? 'success' : 'failed',
          error: nostrResult.error,
          publishedAt: new Date(),
          platformPostId: nostrResult.eventId
        });
        
      } catch (error: any) {
        console.error('Erro ao publicar no Nostr:', error);
        results.nostr = { success: false, error: error.message };
        
        // Log de erro
        await database.createPublicationLog({
          id: randomUUID(),
          postId,
          platform: 'nostr',
          status: 'failed',
          error: error.message,
          publishedAt: new Date()
        });
      }
    }
    
    // Atualiza status do post
    const xSuccess = results.x && results.x.success;
    const nostrSuccess = results.nostr && results.nostr.success;
    const hasSuccess = xSuccess || nostrSuccess;
    const hasError = (results.x && !results.x.success) || (results.nostr && !results.nostr.success);
    
    let status: Post['status'] = 'published';
    if (hasError && !hasSuccess) {
      status = 'failed';
    } else if (hasError && hasSuccess) {
      status = 'partial';
    }
    
    await database.updatePostStatus(postId, status);
    
    return { postId, results };
    
  } catch (error: any) {
    console.error('Erro geral na publicação:', error);
    await database.updatePostStatus(postId, 'failed');
    throw error;
  }
}

// Busca os logs de uma publicação
export async function getPublicationLogs(postId: string): Promise<PublicationLog[]> {
  return database.getPublicationLogsByPostId(postId);
}

// Busca um post por ID
export async function getPost(postId: string): Promise<Post | null> {
  return database.getPostById(postId);
} 