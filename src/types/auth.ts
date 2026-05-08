import "next-auth"
import "next-auth/jwt"

/**
 * Auth.js type augmentations for custom user fields.
 */
declare module "next-auth" {
  interface User {
    id: string
    role?: string
  }

  interface Session {
    user: {
      id: string
      role: string
      email?: string | null
      name?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
  }
}
