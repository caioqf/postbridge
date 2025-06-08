import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import database from '../database';
import twitterService from '../services/twitter';
import nostrService from '../services/nostr';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth';
import { encrypt } from '../utils/crypto';
import { User, NostrAuthRequest } from '../types';

const router = Router();

// Armazena temporariamente os tokens OAuth do Twitter
const tempTwitterTokens = new Map<string, { oauthToken: string; oauthTokenSecret: string }>();

// Inicia autenticação com Twitter
router.get('/twitter/login', async (req: Request, res: Response) => {
  try {
    const { url, oauthToken, oauthTokenSecret } = await twitterService.getAuthUrl();
    
    // Armazena temporariamente os tokens
    const sessionId = randomUUID();
    tempTwitterTokens.set(sessionId, { oauthToken, oauthTokenSecret });
    
    // Remove após 10 minutos
    setTimeout(() => {
      tempTwitterTokens.delete(sessionId);
    }, 10 * 60 * 1000);

    res.json({
      authUrl: url,
      sessionId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Callback do Twitter OAuth
router.get('/twitter/callback', async (req: Request, res: Response) => {
  try {
    const { oauth_token, oauth_verifier, state } = req.query;
    
    if (!oauth_token || !oauth_verifier) {
      return res.status(400).json({ error: 'Missing OAuth parameters' });
    }

    // Busca os tokens temporários
    const sessionId = state as string;
    const tempTokens = tempTwitterTokens.get(sessionId);
    
    if (!tempTokens) {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    // Troca por tokens de acesso
    const { accessToken, accessSecret } = await twitterService.getAccessTokens(
      tempTokens.oauthToken,
      tempTokens.oauthTokenSecret,
      oauth_verifier as string
    );

    // Cria ou atualiza usuário
    const userId = randomUUID();
    const user: User = {
      id: userId,
      createdAt: new Date(),
      twitterAccessToken: encrypt(accessToken),
      twitterAccessSecret: encrypt(accessSecret)
    };

    await database.createUser(user);

    // Limpa tokens temporários
    tempTwitterTokens.delete(sessionId);

    // Gera JWT
    const token = generateToken(userId);

    res.json({
      success: true,
      token,
      userId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Autenticação com Nostr
router.post('/nostr/login', async (req: Request, res: Response) => {
  try {
    const { privateKey }: NostrAuthRequest = req.body;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key is required' });
    }

    // Valida a chave privada
    if (!nostrService.isValidPrivateKey(privateKey)) {
      return res.status(400).json({ error: 'Invalid private key' });
    }

    // Cria usuário
    const userId = randomUUID();
    const user: User = {
      id: userId,
      createdAt: new Date(),
      nostrPrivateKey: encrypt(privateKey)
    };

    await database.createUser(user);

    // Gera JWT
    const token = generateToken(userId);

    res.json({
      success: true,
      token,
      userId,
      publicKey: nostrService.getPublicKey(privateKey)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Adiciona autenticação Nostr a usuário existente
router.post('/nostr/add', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { privateKey }: NostrAuthRequest = req.body;
    const userId = req.userId!;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key is required' });
    }

    // Valida a chave privada
    if (!nostrService.isValidPrivateKey(privateKey)) {
      return res.status(400).json({ error: 'Invalid private key' });
    }

    // Atualiza usuário
    await database.updateUserNostrKey(userId, encrypt(privateKey));

    res.json({
      success: true,
      publicKey: nostrService.getPublicKey(privateKey)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Gera nova chave privada Nostr
router.get('/nostr/generate-key', (req: Request, res: Response) => {
  try {
    const privateKey = nostrService.generatePrivateKey();
    const publicKey = nostrService.getPublicKey(privateKey);

    res.json({
      privateKey,
      publicKey
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 