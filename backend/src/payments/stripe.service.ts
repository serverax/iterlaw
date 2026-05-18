/**
 * STRIPE INTEGRATION
 *
 * - Subscriptions (Essential, Active Case)
 * - Webhooks
 * - Tier management
 * Adapted to use Supabase.
 */

import Stripe from "stripe";
import { SupabaseClient } from "@supabase/supabase-js";

export class StripeService {
  private stripe: any;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
    this.supabase = supabase;
  }

  async createSubscription(
    userId: string,
    planId: "essential" | "active_case"
  ): Promise<any> {
    const { data: user, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !user) throw new Error("User not found");

    const subscription = await this.stripe.subscriptions.create({
      customer: user.stripe_customer_id,
      items: [{ price: this.getPriceId(planId) }],
      payment_behavior: "default_incomplete",
    });

    // Update user tier
    await this.supabase
      .from("users")
      .update({ subscription_tier: planId })
      .eq("id", userId);

    return subscription;
  }

  async handleWebhook(event: any): Promise<void> {
    switch (event.type) {
      case "customer.subscription.updated":
        // Logic to update user tier in Supabase
        break;
      case "customer.subscription.deleted":
        // Revert to free
        break;
      case "payment_intent.succeeded":
        // Log payment
        break;
    }
  }

  private getPriceId(plan: string): string {
    const priceMap: Record<string, string> = {
      essential: process.env.STRIPE_PRICE_ESSENTIAL || "price_test_essential",
      active_case: process.env.STRIPE_PRICE_ACTIVE_CASE || "price_test_active",
    };
    return priceMap[plan];
  }
}
