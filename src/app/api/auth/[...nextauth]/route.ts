// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // หน้า Custom (ถ้าไม่ใส่ Google จะสร้างหน้า Login ให้อัตโนมัติ)
  pages: {
    signIn: '/', // ให้เด้งกลับมาหน้าแรกถ้ากด Login
  }
});

export { handler as GET, handler as POST };