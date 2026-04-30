import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { z } from "zod";
import type { DefaultUser } from "next-auth";

// Extend the default User type with role
declare global {
  namespace NextAuth {
    interface User extends DefaultUser {
      id: string;
      role?: string;
    }
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "your@email.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate input
        const validatedCredentials = credentialsSchema.safeParse(credentials);
        if (!validatedCredentials.success) {
          return null;
        }

        const { email, password } = validatedCredentials.data;

        // Find user
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        // Check password
        const passwordMatch = await compare(password, user.password);
        if (!passwordMatch) {
          return null;
        }

        // Return user object for session
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Session callback - runs when reading session
     * Adds user role to session object exposed to client
     */
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        (session.user as any).role = user.role;
      }
      return session;
    },
  },
  session: {
    strategy: "database",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // 1 day
  },
  events: {
    async signIn({ user }) {
      console.log(`[Auth] User signed in: ${user?.email}`);
    },
    async signOut({ token }) {
      console.log(`[Auth] User signed out: ${token?.email}`);
    },
  },
});
