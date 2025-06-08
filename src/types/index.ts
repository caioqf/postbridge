export interface User {
  id: string;
  createdAt: Date;
  twitterAccessToken?: string;
  twitterAccessSecret?: string;
  nostrPrivateKey?: string;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls?: string[];
  scheduledAt?: Date;
  createdAt: Date;
  status: 'pending' | 'published' | 'failed' | 'partial';
}

export interface PublicationLog {
  id: string;
  postId: string;
  platform: 'twitter' | 'nostr';
  status: 'success' | 'failed';
  error?: string;
  publishedAt: Date;
  platformPostId?: string;
}

export interface CreatePostRequest {
  content: string;
  mediaUrls?: string[];
  scheduledAt?: string;
}

export interface TwitterAuthTokens {
  accessToken: string;
  accessSecret: string;
}

export interface NostrAuthRequest {
  privateKey: string;
} 