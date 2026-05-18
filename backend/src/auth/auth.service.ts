/**
 * AUTHENTICATION SERVICE
 *
 * Supports: Google, LinkedIn, Microsoft, Apple, Facebook OAuth
 * Generates JWT (15min) + Refresh tokens (30day)
 * Adapted to use Supabase instead of Prisma for local parity.
 */

import * as jwt from "jsonwebtoken";
import { SupabaseClient } from "@supabase/supabase-js";

export interface User {
  id: string;
  email: string;
  auth_provider: "google" | "linkedin" | "microsoft" | "apple" | "facebook";
  created_at: Date;
  subscription_tier: "free" | "essential" | "active_case";
  free_questions_remaining: number;
  case_id?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}

export class AuthService {
  private supabase: SupabaseClient;
  private jwtSecret = process.env.JWT_SECRET || "dev-secret";

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async loginWithGoogle(idToken: string): Promise<AuthTokens> {
    const payload = await this.verifyGoogleToken(idToken);

    const { data: user, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("email", payload.email)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!user) {
      const { data: newUser, error: createError } = await this.supabase
        .from("users")
        .insert({
          email: payload.email,
          auth_provider: "google",
          subscription_tier: "free",
          free_questions_remaining: 3,
        })
        .select("*")
        .single();
      
      if (createError) throw createError;
      return this.generateTokens(newUser as User);
    }

    return this.generateTokens(user as User);
  }

  async loginWithLinkedIn(idToken: string): Promise<AuthTokens> {
    const payload = await this.verifyLinkedInToken(idToken);
    const { data: user } = await this.supabase.from("users").select("*").eq("email", payload.email).single();

    if (!user) {
      const { data: newUser } = await this.supabase.from("users").insert({
        email: payload.email,
        auth_provider: "linkedin",
        subscription_tier: "free",
        free_questions_remaining: 3,
      }).select("*").single();
      return this.generateTokens(newUser as User);
    }

    return this.generateTokens(user as User);
  }

  async loginWithMicrosoft(idToken: string): Promise<AuthTokens> {
    const payload = await this.verifyMicrosoftToken(idToken);
    const { data: user } = await this.supabase.from("users").select("*").eq("email", payload.email).single();

    if (!user) {
      const { data: newUser } = await this.supabase.from("users").insert({
        email: payload.email,
        auth_provider: "microsoft",
        subscription_tier: "free",
        free_questions_remaining: 3,
      }).select("*").single();
      return this.generateTokens(newUser as User);
    }

    return this.generateTokens(user as User);
  }

  async loginWithApple(idToken: string): Promise<AuthTokens> {
    const payload = await this.verifyAppleToken(idToken);
    const { data: user } = await this.supabase.from("users").select("*").eq("email", payload.email).single();

    if (!user) {
      const { data: newUser } = await this.supabase.from("users").insert({
        email: payload.email,
        auth_provider: "apple",
        subscription_tier: "free",
        free_questions_remaining: 3,
      }).select("*").single();
      return this.generateTokens(newUser as User);
    }

    return this.generateTokens(user as User);
  }

  async loginWithFacebook(idToken: string): Promise<AuthTokens> {
    const payload = await this.verifyFacebookToken(idToken);
    const { data: user } = await this.supabase.from("users").select("*").eq("email", payload.email).single();

    if (!user) {
      const { data: newUser } = await this.supabase.from("users").insert({
        email: payload.email,
        auth_provider: "facebook",
        subscription_tier: "free",
        free_questions_remaining: 3,
      }).select("*").single();
      return this.generateTokens(newUser as User);
    }

    return this.generateTokens(user as User);
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      const { data: user } = await this.supabase.from("users").select("*").eq("id", decoded.userId).single();
      return user as User;
    } catch (error) {
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<string> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret + "-refresh") as { userId: string };
      const { data: user } = await this.supabase.from("users").select("*").eq("id", decoded.userId).single();

      if (!user) throw new Error("User not found");

      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email, tier: user.subscription_tier },
        this.jwtSecret,
        { expiresIn: "15m" }
      );

      return newAccessToken;
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  private generateTokens(user: User): AuthTokens {
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, tier: user.subscription_tier },
      this.jwtSecret,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.jwtSecret + "-refresh",
      { expiresIn: "30d" }
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  // OAuth verification stubs (implement with real providers)
  private async verifyGoogleToken(token: string): Promise<any> {
    return { email: "user@gmail.com" };
  }

  private async verifyLinkedInToken(token: string): Promise<any> {
    return { email: "user@linkedin.com" };
  }

  private async verifyMicrosoftToken(token: string): Promise<any> {
    return { email: "user@microsoft.com" };
  }

  private async verifyAppleToken(token: string): Promise<any> {
    return { email: "user@apple.com" };
  }

  private async verifyFacebookToken(token: string): Promise<any> {
    return { email: "user@facebook.com" };
  }
}
