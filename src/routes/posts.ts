import { Router, Response } from 'express';
import { publishPost, getPost, getPublicationLogs } from '../services/publisher';
import database from '../database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { content, mediaUrls } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }
    
    if (content.length > 280) {
      return res.status(400).json({ error: 'Conteúdo deve ter no máximo 280 caracteres' });
    }
    
    if (mediaUrls && (!Array.isArray(mediaUrls) || mediaUrls.some((url: any) => typeof url !== 'string'))) {
      return res.status(400).json({ error: 'URLs de mídia devem ser um array de strings' });
    }
    
    const user = await database.getUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const result = await publishPost(user, content, mediaUrls);
    
    res.json({
      success: true,
      postId: result.postId,
      results: result.results
    });
    
  } catch (error: any) {
    console.error('Erro ao criar post:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const post = await getPost(id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }
    
    if (post.userId !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    res.json(post);
    
  } catch (error: any) {
    console.error('Erro ao buscar post:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/:id/logs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const post = await getPost(id);
    if (!post || post.userId !== req.userId) {
      return res.status(404).json({ error: 'Post não encontrado' });
    }
    
    const logs = await getPublicationLogs(id);
    res.json(logs);
    
  } catch (error: any) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 