import { TwitterApi } from 'twitter-api-v2';
import { XAuthTokens } from '../types';

class XService {
  private consumerKey: string;
  private consumerSecret: string;
  private callbackUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.consumerKey = process.env.X_CONSUMER_KEY || process.env.TWITTER_CONSUMER_KEY || '';
    this.consumerSecret = process.env.X_CONSUMER_SECRET || process.env.TWITTER_CONSUMER_SECRET || '';
    this.callbackUrl = process.env.X_CALLBACK_URL || process.env.TWITTER_CALLBACK_URL || '';

    this.isConfigured = !!(this.consumerKey && this.consumerSecret && this.callbackUrl);

    if (!this.isConfigured) {
      console.warn('⚠️  X API credentials not configured. X features will be disabled.');
    }
  }

  private checkConfiguration(): void {
    if (!this.isConfigured) {
      throw new Error('X API credentials not configured');
    }
  }

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

  async getAccessTokens(
    oauthToken: string,
    oauthTokenSecret: string,
    oauthVerifier: string
  ): Promise<XAuthTokens> {
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

  async publishPost(
    accessToken: string,
    accessSecret: string,
    content: string,
    mediaUrls?: string[]
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      this.checkConfiguration();
      
      const client = new TwitterApi({
        appKey: this.consumerKey,
        appSecret: this.consumerSecret,
        accessToken,
        accessSecret,
      });

      const post = await client.v2.tweet(content);
      
      return {
        success: true,
        postId: post.data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to publish post',
      };
    }
  }

  async verifyCredentials(accessToken: string, accessSecret: string): Promise<boolean> {
    try {
      this.checkConfiguration();
      
      const client = new TwitterApi({
        appKey: this.consumerKey,
        appSecret: this.consumerSecret,
        accessToken,
        accessSecret,
      });

      await client.v1.verifyCredentials();
      return true;
    } catch {
      return false;
    }
  }

  async getUserInfo(accessToken: string, accessSecret: string): Promise<{ username: string; name: string } | null> {
    try {
      this.checkConfiguration();
      
      const client = new TwitterApi({
        appKey: this.consumerKey,
        appSecret: this.consumerSecret,
        accessToken,
        accessSecret,
      });

      const user = await client.v1.verifyCredentials();
      return {
        username: user.screen_name,
        name: user.name
      };
    } catch (error) {
      console.error('Error getting X user info:', error);
      return null;
    }
  }

  isXConfigured(): boolean {
    return this.isConfigured;
  }
}

export default new XService(); 