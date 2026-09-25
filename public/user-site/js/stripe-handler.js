// Stripe Payment Handler
import { auth, db } from "./firebase-config.js";
import {
  doc,
  updateDoc,
  increment,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

class StripePaymentHandler {
  constructor() {
    // Initialize Stripe
    // Note: Replace with your actual Stripe public key
    this.stripePublicKey = "pk_test_51234567890ABCDEFGHIJ";
    this.stripe = null;
    this.elements = null;
    this.cardElement = null;
  }

  // Initialize Stripe
  async initialize(publicKey) {
    try {
      // Load Stripe
      const stripeScript = document.createElement("script");
      stripeScript.src = "https://js.stripe.com/v3/";
      stripeScript.onload = () => {
        this.stripe = window.Stripe(publicKey || this.stripePublicKey);
      };
      document.body.appendChild(stripeScript);
    } catch (error) {
      console.error("Error initializing Stripe:", error);
    }
  }

  // Diamond packages
  static PACKAGES = {
    starter: { 
      name: "Starter",
      diamonds: 100, 
      price: 4.99, 
      currency: "USD" 
    },
    popular: { 
      name: "Popular",
      diamonds: 500, 
      price: 19.99, 
      currency: "USD" 
    },
    premium: { 
      name: "Premium",
      diamonds: 1500, 
      price: 49.99, 
      currency: "USD" 
    },
    elite: { 
      name: "Elite",
      diamonds: 5000, 
      price: 149.99, 
      currency: "USD" 
    }
  };

  // Create payment intent
  async createPaymentIntent(packageType) {
    const package = StripePaymentHandler.PACKAGES[packageType];
    
    if (!package) {
      throw new Error("Invalid package type");
    }

    try {
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageType,
          amount: package.price,
          diamonds: package.diamonds,
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          currency: package.currency
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create payment intent");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw error;
    }
  }

  // Process payment
  async processPayment(packageType, cardElement) {
    try {
      // Create payment intent
      const paymentData = await this.createPaymentIntent(packageType);
      const clientSecret = paymentData.clientSecret;

      // Confirm payment
      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            email: auth.currentUser.email
          }
        }
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (result.paymentIntent.status === "succeeded") {
        // Payment successful
        await this.handlePaymentSuccess(packageType, result.paymentIntent.id);
        return {
          success: true,
          message: "Payment successful!",
          paymentIntentId: result.paymentIntent.id
        };
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      return {
        success: false,
        message: error.message || "Payment failed"
      };
    }
  }

  // Handle successful payment
  async handlePaymentSuccess(packageType, paymentIntentId) {
    const package = StripePaymentHandler.PACKAGES[packageType];
    const userId = auth.currentUser.uid;

    try {
      // Add diamonds to user
      await updateDoc(doc(db, "users", userId), {
        diamonds: increment(package.diamonds)
      });

      // Record transaction
      await addDoc(collection(db, "transactions"), {
        userId,
        type: "diamond_purchase",
        packageType,
        amount: package.price,
        diamonds: package.diamonds,
        paymentIntentId,
        status: "completed",
        timestamp: serverTimestamp(),
        currency: package.currency
      });

      // Send notification
      if (window.toast) {
        window.toast(`💎 Added ${package.diamonds} diamonds to your account!`);
      }
    } catch (error) {
      console.error("Error handling payment success:", error);
    }
  }

  // Get transaction history
  static async getTransactionHistory(userId, limit = 50) {
    try {
      const transactionsSnapshot = await getDocs(
        query(
          collection(db, "transactions"),
          where("userId", "==", userId),
          orderBy("timestamp", "desc"),
          limit(limit)
        )
      );

      return transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }
  }

  // Format price
  static formatPrice(amount, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(amount);
  }
}

export default new StripePaymentHandler();
