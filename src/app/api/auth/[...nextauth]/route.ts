// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";

// ==================== TYPE EXTENSIONS ====================
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      image?: string | null;
      // email?: string | null; // ไม่ต้องใส่อีเมล
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
        console.log("[NextAuth] Initial sign in for:", user.email);
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000,
          user,
        };
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to refresh it
      console.log("[NextAuth] Access token expired, refreshing...");
      return refreshAccessToken(token);
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
      
      // Allow all Google sign-ins
      if (account?.provider === "google") {
        return true;
      }
      
      return true;
    },
    
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
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
    },
    async signOut({ token }) {
      console.log("[NextAuth] User signed out:", {
        email: (token as any)?.email,
        timestamp: new Date().toISOString(),
      });
    },
    async createUser({ user }) {
      console.log("[NextAuth] New user created:", {
        email: user.email,
        timestamp: new Date().toISOString(),
      });
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