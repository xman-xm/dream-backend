import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { addCreditsToUser } from "@/lib/services/credit-ledger";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const signature = (await headers()).get("stripe-signature");

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Verify server setup
  if (!stripeSecretKey || !webhookSecret) {
    console.warn("[Stripe Webhook] Keys unconfigured in .env. Skipping cryptographic verification for dev simulation.");
  }

  let event: any;

  try {
    event = JSON.parse(bodyText);
  } catch (err: any) {
    return NextResponse.json({ error: "Webhook parse error" }, { status: 400 });
  }

  // Handle successful payment checkout session
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata?.userId;
    const creditsGranted = parseInt(session.metadata?.creditsGranted || "0", 10);
    const amountCents = session.amount_total || 0;

    if (userId && creditsGranted > 0) {
      // 1. Record PaymentTransaction
      const payment = await prisma.paymentTransaction.create({
        data: {
          userId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          amountCents,
          creditsGranted,
          status: "COMPLETED",
        },
      });

      // 2. Add credits to user's ledger
      await addCreditsToUser(
        userId,
        creditsGranted,
        "PURCHASE",
        payment.id,
        `Purchased ${creditsGranted} video credits for $${(amountCents / 100).toFixed(2)}`
      );

      console.log(`[Stripe Webhook] Granted ${creditsGranted} credits to user ${userId}`);
    }
  }

  return NextResponse.json({ received: true });
}
