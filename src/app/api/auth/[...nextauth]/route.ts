// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import FacebookProvider from "next-auth/providers/facebook";
import AppleProvider from "next-auth/providers/apple";
import LineProvider from "next-auth/providers/line";
import { JWT } from "next-auth/jwt";
import { putJson } from "@/lib/filebase";

// Helper to save user log server-side
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
    const fullLog = {
      ...log,
      id,
      timestamp: new Date().toISOString(),
    };
    await putJson(`user-logs/${id}.json`, fullLog);
  } catch (e) {
    console.warn("[NextAuth] Failed to save user log:", e);
  }
}

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

// ==================== HELPER FUNCTIONS ====================
/**
 * Refresh the access token using the refresh token
 */
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

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("[NextAuth] Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

// ==================== AUTH OPTIONS ====================
// ==================== PROVIDER NAME MAP ====================
const providerNameMap: Record<string, string> = {
  google: 'Google',
  'azure-ad': 'Microsoft',
  facebook: 'Facebook',
  apple: 'Apple',
  line: 'LINE',
};

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
    // Microsoft (Azure AD)
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            tenantId: process.env.AZURE_AD_TENANT_ID || 'common',
          }),
        ]
      : []),
    // Facebook
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID!,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
          }),
        ]
      : []),
    // Apple
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID!,
            clientSecret: process.env.APPLE_SECRET!,
          }),
        ]
      : []),
    // LINE
    ...(process.env.LINE_CLIENT_ID && process.env.LINE_CLIENT_SECRET
      ? [
          LineProvider({
            clientId: process.env.LINE_CLIENT_ID!,
            clientSecret: process.env.LINE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  
  // Custom pages
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  
  // Session configuration
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Callbacks
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        console.log("[NextAuth] Initial sign in for:", user.email, "via", account.provider);
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000,
          provider: account.provider,
          user,
        };
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Only refresh Google tokens (other providers don't support refresh the same way)
      if (token.provider === 'google' && token.refreshToken) {
        console.log("[NextAuth] Access token expired, refreshing...");
        return refreshAccessToken(token);
      }

      // For non-Google providers, just return the token as-is
      return token;
    },
    
    async session({ session, token }): Promise<Session> {
      if (token) {
        session.accessToken = token.accessToken;
        session.error = token.error;
        
        if (token.user) {
          session.user = token.user as Session["user"];
        }
      }
      return session;
    },
    
    async signIn({ user, account, profile }) {
      // Log sign in attempts
      console.log("[NextAuth] Sign in attempt:", {
        email: user.email,
        provider: account?.provider,
        timestamp: new Date().toISOString(),
      });
      
      // Allow all OAuth sign-ins
      const allowedProviders = ['google', 'azure-ad', 'facebook', 'apple', 'line'];
      if (account?.provider && allowedProviders.includes(account.provider)) {
        return true;
      }
      
      return true;
    },
    
    async redirect({ url, baseUrl }) {
      // Normalize: remove trailing slash
      const clean = (u: string) => u.replace(/\/+$/, '') || u;
      const base = clean(baseUrl);
      
      // Root callback → go to base URL
      if (url === '/' || url === baseUrl || url === base) return base;
      // Relative callback URLs
      if (url.startsWith('/')) return `${base}${url}`;
      // Same origin
      try {
        const target = clean(url);
        if (new URL(target).origin === new URL(base).origin) return target;
      } catch {}
      return base;
    },
  },
  
  // Events for logging
  events: {
    async signIn({ user, account }) {
      console.log("[NextAuth] User signed in:", {
        email: user.email,
        provider: account?.provider,
        timestamp: new Date().toISOString(),
      });
      
      // Save to user logs
      if (user.email) {
        await saveUserLogServer({
          email: user.email,
          name: user.name || undefined,
          action: 'login',
          details: `เข้าสู่ระบบด้วย ${providerNameMap[account?.provider || ''] || account?.provider || 'Unknown'}`,
          metadata: { provider: account?.provider },
        });
      }
    },
    async signOut({ token }) {
      console.log("[NextAuth] User signed out:", {
        email: (token as any)?.email,
        timestamp: new Date().toISOString(),
      });
      
      // Save to user logs
      const email = (token as any)?.email;
      if (email) {
        await saveUserLogServer({
          email,
          action: 'logout',
          details: 'ออกจากระบบ',
        });
      }
    },
    async createUser({ user }) {
      console.log("[NextAuth] New user created:", {
        email: user.email,
        timestamp: new Date().toISOString(),
      });
      
      // Save to user logs
      if (user.email) {
        await saveUserLogServer({
          email: user.email,
          name: user.name || undefined,
          action: 'login',
          details: 'สมัครสมาชิกใหม่',
          metadata: { isNewUser: true },
        });
      }
    },
    async session({ session }) {
      // Log session access (be careful with frequency)
      if (session.error) {
        console.warn("[NextAuth] Session error:", session.error);
      }
    },
  },
  
  // Enable debug in development
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };