// src/lib/auth-options.ts
// NextAuth configuration - extracted from route file for Next.js 16 compatibility

import { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import FacebookProvider from "next-auth/providers/facebook";
import AppleProvider from "next-auth/providers/apple";
import LineProvider from "next-auth/providers/line";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { putJson, getJson } from "@/lib/filebase";
import { verifyPasskeyLoginToken } from "@/lib/passkey";
import { createHash } from 'crypto';

// ==================== TYPE EXTENSIONS ====================
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
    provider?: string;
  }
}

// ==================== HELPERS ====================

async function saveUserLogServer(log: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) {
  try {
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullLog = { ...log, id, timestamp: new Date().toISOString() };
    await putJson(`user-logs/${id}.json`, fullLog);
  } catch (e) {
    console.warn("[NextAuth] Failed to save user log:", e);
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
      }),
    });
    const refreshedTokens = await response.json();
    if (!response.ok) throw refreshedTokens;
    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("[NextAuth] Error refreshing access token:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

const providerNameMap: Record<string, string> = {
  google: 'Google',
  'azure-ad': 'Microsoft',
  facebook: 'Facebook',
  apple: 'Apple',
  line: 'LINE',
  passkey: 'Passkey',
};

// ==================== AUTH OPTIONS ====================

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [AzureADProvider({
          clientId: process.env.AZURE_AD_CLIENT_ID!,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
          tenantId: process.env.AZURE_AD_TENANT_ID || 'common',
        })]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [FacebookProvider({
          clientId: process.env.FACEBOOK_CLIENT_ID!,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
        })]
      : []),
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [AppleProvider({
          clientId: process.env.APPLE_ID!,
          clientSecret: process.env.APPLE_SECRET!,
        })]
      : []),
    ...(process.env.LINE_CLIENT_ID && process.env.LINE_CLIENT_SECRET
      ? [LineProvider({
          clientId: process.env.LINE_CLIENT_ID!,
          clientSecret: process.env.LINE_CLIENT_SECRET!,
        })]
      : []),
    CredentialsProvider({
      id: 'passkey',
      name: 'Passkey',
      credentials: { token: { label: 'Passkey Token', type: 'text' } },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        try {
          const email = await verifyPasskeyLoginToken(credentials.token);
          if (!email) return null;
          let name = email.split('@')[0];
          let image: string | undefined;
          try {
            const hash = createHash('sha256').update(email.toLowerCase()).digest('hex');
            const profile = await getJson(`users/${hash}.json`) as any;
            if (profile?.name) name = profile.name;
            if (profile?.profileImage) image = profile.profileImage;
          } catch { /* no profile yet */ }
          return { id: email, email, name, image: image || undefined };
        } catch (err) {
          console.error('[NextAuth] Passkey authorize error:', err);
          return null;
        }
      },
    }),
  ],
  pages: { signIn: '/', error: '/auth/error' },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000,
          provider: account.provider,
          user,
        };
      }
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) return token;
      if (token.provider === 'google' && token.refreshToken) return refreshAccessToken(token);
      return token;
    },
    async session({ session, token }): Promise<Session> {
      if (token) {
        session.accessToken = token.accessToken;
        session.error = token.error;
        if (token.user) session.user = token.user as Session["user"];
      }
      return session;
    },
    async signIn({ user, account }) {
      console.log("[NextAuth] Sign in attempt:", { email: user.email, provider: account?.provider });
      return true;
    },
    async redirect({ url, baseUrl }) {
      const clean = (u: string) => u.replace(/\/+$/, '') || u;
      const base = clean(baseUrl);
      if (url === '/' || url === baseUrl || url === base) return base;
      if (url.startsWith('/')) return `${base}${url}`;
      try {
        const target = clean(url);
        if (new URL(target).origin === new URL(base).origin) return target;
      } catch {}
      return base;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (user.email) {
        // Fire-and-forget: don't block login waiting for S3 write
        saveUserLogServer({
          email: user.email,
          name: user.name || undefined,
          action: 'login',
          details: `เข้าสู่ระบบด้วย ${providerNameMap[account?.provider || ''] || account?.provider || 'Unknown'}`,
          metadata: { provider: account?.provider },
        }).catch(e => console.warn('[NextAuth] signIn log failed:', e));
      }
    },
    async signOut({ token }) {
      const email = (token as any)?.email;
      if (email) {
        // Fire-and-forget: don't block logout waiting for S3 write
        saveUserLogServer({ email, action: 'logout', details: 'ออกจากระบบ' })
          .catch(e => console.warn('[NextAuth] signOut log failed:', e));
      }
    },
    async createUser({ user }) {
      if (user.email) {
        // Fire-and-forget: don't block user creation waiting for S3 write
        saveUserLogServer({
          email: user.email,
          name: user.name || undefined,
          action: 'login',
          details: 'สมัครสมาชิกใหม่',
          metadata: { isNewUser: true },
        }).catch(e => console.warn('[NextAuth] createUser log failed:', e));
      }
    },
    async session({ session }) {
      if (session.error) console.warn("[NextAuth] Session error:", session.error);
    },
  },
  debug: process.env.NODE_ENV === "development",
};
