import sqlite3 from 'sqlite3';
import { User, Post, PublicationLog } from '../types';

const DATABASE_PATH = process.env.DATABASE_PATH || './database.sqlite';

class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DATABASE_PATH);
    this.initTables();
  }

  private initTables(): void {
    this.db.serialize(() => {
      // Users table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          name TEXT,
          password TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          x_access_token TEXT,
          x_access_secret TEXT,
          x_username TEXT,
          nostr_private_key TEXT
        )
      `);

      // Posts table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          media_urls TEXT,
          scheduled_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'pending',
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Publication logs table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS publication_logs (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          platform_post_id TEXT,
          FOREIGN KEY (post_id) REFERENCES posts (id)
        )
      `);

      // Migration: Rename twitter columns to x columns (for existing databases)
      this.db.run(`
        ALTER TABLE users RENAME COLUMN twitter_access_token TO x_access_token
      `, (err) => {
        if (err && !err.message.includes('no such column') && !err.message.includes('duplicate column name')) {
          console.error('Error renaming twitter_access_token column:', err);
        }
      });

      this.db.run(`
        ALTER TABLE users RENAME COLUMN twitter_access_secret TO x_access_secret
      `, (err) => {
        if (err && !err.message.includes('no such column') && !err.message.includes('duplicate column name')) {
          console.error('Error renaming twitter_access_secret column:', err);
        }
      });

      this.db.run(`
        ALTER TABLE users RENAME COLUMN twitter_username TO x_username
      `, (err) => {
        if (err && !err.message.includes('no such column') && !err.message.includes('duplicate column name')) {
          console.error('Error renaming twitter_username column:', err);
        }
      });

      // Add x columns if they don't exist (fallback for new databases)
      this.db.run(`
        ALTER TABLE users ADD COLUMN x_access_token TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          // Ignore error if column already exists
        }
      });

      this.db.run(`
        ALTER TABLE users ADD COLUMN x_access_secret TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          // Ignore error if column already exists
        }
      });

      this.db.run(`
        ALTER TABLE users ADD COLUMN x_username TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          // Ignore error if column already exists
        }
      });
    });
  }

  // User operations
  createUser(user: User): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO users (id, email, name, password, x_access_token, x_access_secret, x_username, nostr_private_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        user.id,
        user.email || null,
        user.name || null,
        user.password || null,
        user.xAccessToken || null,
        user.xAccessSecret || null,
        user.xUsername || null,
        user.nostrPrivateKey || null
      ], function(err) {
        if (err) reject(err);
        else resolve();
      });
      
      stmt.finalize();
    });
  }

  getUserById(id: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else {
            resolve({
              id: row.id,
              email: row.email,
              name: row.name,
              password: row.password,
              createdAt: new Date(row.created_at),
              xAccessToken: row.x_access_token,
              xAccessSecret: row.x_access_secret,
              xUsername: row.x_username,
              nostrPrivateKey: row.nostr_private_key
            });
          }
        }
      );
    });
  }

  getUserByEmail(email: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, row: any) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else {
            resolve({
              id: row.id,
              email: row.email,
              name: row.name,
              password: row.password,
              createdAt: new Date(row.created_at),
              xAccessToken: row.x_access_token,
              xAccessSecret: row.x_access_secret,
              xUsername: row.x_username,
              nostrPrivateKey: row.nostr_private_key
            });
          }
        }
      );
    });
  }

  updateUserXTokens(userId: string, accessToken: string, accessSecret: string, username?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET x_access_token = ?, x_access_secret = ?, x_username = ? WHERE id = ?',
        [accessToken, accessSecret, username || null, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  updateUserNostrKey(userId: string, privateKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET nostr_private_key = ? WHERE id = ?',
        [privateKey, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Disconnect platform methods
  disconnectUserX(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET x_access_token = NULL, x_access_secret = NULL, x_username = NULL WHERE id = ?',
        [userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  disconnectUserNostr(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET nostr_private_key = NULL WHERE id = ?',
        [userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Post operations
  createPost(post: Post): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO posts (id, user_id, content, media_urls, scheduled_at, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        post.id,
        post.userId,
        post.content,
        post.mediaUrls ? JSON.stringify(post.mediaUrls) : null,
        post.scheduledAt ? post.scheduledAt.toISOString() : null,
        post.status
      ], function(err) {
        if (err) reject(err);
        else resolve();
      });
      
      stmt.finalize();
    });
  }

  getPostById(id: string): Promise<Post | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM posts WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else {
            resolve({
              id: row.id,
              userId: row.user_id,
              content: row.content,
              mediaUrls: row.media_urls ? JSON.parse(row.media_urls) : undefined,
              scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
              createdAt: new Date(row.created_at),
              status: row.status
            });
          }
        }
      );
    });
  }

  updatePostStatus(postId: string, status: Post['status']): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE posts SET status = ? WHERE id = ?',
        [status, postId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Publication log operations
  createPublicationLog(log: PublicationLog): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO publication_logs (id, post_id, platform, status, error, platform_post_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        log.id,
        log.postId,
        log.platform,
        log.status,
        log.error || null,
        log.platformPostId || null
      ], function(err) {
        if (err) reject(err);
        else resolve();
      });
      
      stmt.finalize();
    });
  }

  getPublicationLogsByPostId(postId: string): Promise<PublicationLog[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM publication_logs WHERE post_id = ?',
        [postId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else {
            const logs = rows.map(row => ({
              id: row.id,
              postId: row.post_id,
              platform: row.platform,
              status: row.status,
              error: row.error,
              publishedAt: new Date(row.published_at),
              platformPostId: row.platform_post_id
            }));
            resolve(logs);
          }
        }
      );
    });
  }

  close(): void {
    this.db.close();
  }
}

export default new Database(); 