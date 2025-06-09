import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { publishPost, getPost, getPublicationLogs } from '../services/publisher';
import database from '../database';
import { CreatePostRequest } from '../types';

const router = Router();

// Criar e publicar post
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { content, mediaUrls }: CreatePostRequest = req.body;
    const userId = req.userId!;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Validações básicas
    if (content.length > 280) {
      return res.status(400).json({ error: 'Content exceeds 280 characters' });
    }

    if (mediaUrls && mediaUrls.length > 4) {
      return res.status(400).json({ error: 'Maximum 4 media URLs allowed' });
    }

    // Busca o usuário
    const user = await database.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Publica o post
    const result = await publishPost(user, content, mediaUrls);

    res.json({
      success: true,
      postId: result.postId,
      results: result.results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar post por ID
router.get('/:postId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const post = await getPost(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Verifica se o post pertence ao usuário
    if (post.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar logs de publicação
router.get('/:postId/logs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    // Verifica se o post existe e pertence ao usuário
    const post = await getPost(postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logs = await getPublicationLogs(postId);

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 