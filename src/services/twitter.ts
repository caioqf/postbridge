import { TwitterApi } from 'twitter-api-v2';
import { TwitterAuthTokens } from '../types';

class TwitterService {
  private consumerKey: string;
  private consumerSecret: string;
  private callbackUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.consumerKey = process.env.TWITTER_CONSUMER_KEY || '';
    this.consumerSecret = process.env.TWITTER_CONSUMER_SECRET || '';
    this.callbackUrl = process.env.TWITTER_CALLBACK_URL || '';

    this.isConfigured = !!(this.consumerKey && this.consumerSecret && this.callbackUrl);

    if (!this.isConfigured) {
      console.warn('⚠️  Twitter API credentials not configured. Twitter features will be disabled.');
    }
  }

  private checkConfiguration(): void {
    if (!this.isConfigured) {
      throw new Error('Twitter API credentials not configured');
    }
  }

  // Inicia o fluxo OAuth 1.0a
  async getAuthUrl(): Promise<{ url: string; oauthToken: string; oauthTokenSecret: string }> {
    this.checkConfiguration();
    
    const client = new TwitterApi({
      appKey: this.consumerKey,
      appSecret: this.consumerSecret,
    });

    const authLink = await client.generateAuthLink(this.callbackUrl);
    
    return {
      url: authLink.url,
      oauthToken: authLink.oauth_token,
      oauthTokenSecret: authLink.oauth_token_secret,
    };
  }

  // Troca o verifier por tokens de acesso
  async getAccessTokens(
    oauthToken: string,
    oauthTokenSecret: string,
    oauthVerifier: string
  ): Promise<TwitterAuthTokens> {
    this.checkConfiguration();
    
    const client = new TwitterApi({
      appKey: this.consumerKey,
      appSecret: this.consumerSecret,
      accessToken: oauthToken,
      accessSecret: oauthTokenSecret,
    });

    const { accessToken, accessSecret } = await client.login(oauthVerifier);
    
    return {
      accessToken,
      accessSecret,
    };
  }

  // Publica um tweet
  async publishTweet(
    accessToken: string,
    accessSecret: string,
    content: string,
    mediaUrls?: string[]
  ): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      this.checkConfiguration();
      
      const client = new TwitterApi({
        appKey: this.consumerKey,
        appSecret: this.consumerSecret,
        accessToken,
        accessSecret,
      });

      // Por simplicidade do MVP, vamos apenas publicar texto
      // Em uma versão futura, podemos adicionar suporte a mídias
      const tweet = await client.v2.tweet(content);
      
      return {
        success: true,
        tweetId: tweet.data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to publish tweet',
      };
    }
  }

  // Verifica se os tokens são válidos
  async verifyCredentials(accessToken: string, accessSecret: string): Promise<boolean> {
    try {
      this.checkConfiguration();
      
      const client = new TwitterApi({
        appKey: this.consumerKey,
        appSecret: this.consumerSecret,
        accessToken,
        accessSecret,
      });

      await client.v2.me();
      return true;
    } catch {
      return false;
    }
  }

  // Verifica se o serviço está configurado
  isTwitterConfigured(): boolean {
    return this.isConfigured;
  }
}

export default new TwitterService(); 