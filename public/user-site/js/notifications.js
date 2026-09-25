// Notification System
import { auth, db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  doc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

class NotificationManager {
  constructor() {
    this.notifications = [];
    this.unsubscribe = null;
    this.soundEnabled = true;
    this.desktopNotificationsEnabled = false;
  }

  // Initialize notifications
  async initialize() {
    // Check desktop notification permission
    if ("Notification" in window && Notification.permission === "granted") {
      this.desktopNotificationsEnabled = true;
    }

    // Request permission if not denied
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          this.desktopNotificationsEnabled = true;
        }
      });
    }

    this.startListening();
  }

  // Start listening for notifications
  startListening() {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const q = query(
      collection(db, "notifications", userId, "items"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const oldCount = this.notifications.length;
      
      this.notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Show notification for new items
      if (oldCount === 0 && this.notifications.length > 0) {
        this.showNotifications();
      }

      // Callback for UI update
      if (window.onNotificationsUpdate) {
        window.onNotificationsUpdate(this.notifications);
      }
    });
  }

  // Stop listening
  stopListening() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  // Send notification to user
  static async sendNotification(targetUserId, notificationType, data) {
    try {
      await addDoc(
        collection(db, "notifications", targetUserId, "items"),
        {
          type: notificationType,
          title: data.title || "",
          message: data.message || "",
          data: data.data || {},
          read: false,
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      );
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      const userId = auth.currentUser.uid;
      const notifRef = doc(db, "notifications", userId, "items", notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  // Mark all as read
  async markAllAsRead() {
    try {
      const userId = auth.currentUser.uid;
      const unreadNotifs = this.notifications.filter(n => !n.read);

      for (const notif of unreadNotifs) {
        const notifRef = doc(db, "notifications", userId, "items", notif.id);
        await updateDoc(notifRef, { read: true });
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  }

  // Delete notification
  async deleteNotification(notificationId) {
    try {
      const userId = auth.currentUser.uid;
      const notifRef = doc(db, "notifications", userId, "items", notificationId);
      await updateDoc(notifRef, { deleted: true });
      
      this.notifications = this.notifications.filter(n => n.id !== notificationId);
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }

  // Get unread count
  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  // Show notifications
  showNotifications() {
    const unread = this.notifications.filter(n => !n.read);

    for (const notif of unread) {
      // Show desktop notification if enabled
      if (this.desktopNotificationsEnabled) {
        this.showDesktopNotification(notif);
      }

      // Play sound if enabled
      if (this.soundEnabled) {
        this.playNotificationSound();
      }

      // Update UI badge
      if (window.updateNotificationBadge) {
        window.updateNotificationBadge(this.getUnreadCount());
      }
    }
  }

  // Show desktop notification
  showDesktopNotification(notif) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notif.title || "ConnectNow", {
        body: notif.message,
        icon: "/images/logo.png",
        tag: notif.id
      });
    }
  }

  // Play notification sound
  playNotificationSound() {
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(error => {
        console.log("Could not play notification sound:", error);
      });
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  }

  // Toggle sound
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem("notificationSoundEnabled", this.soundEnabled);
  }

  // Get notifications by type
  getByType(type) {
    return this.notifications.filter(n => n.type === type);
  }

  // Clear all old notifications
  async clearOldNotifications() {
    try {
      const userId = auth.currentUser.uid;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const oldNotifs = this.notifications.filter(n => 
        n.createdAt?.toDate() < thirtyDaysAgo
      );

      for (const notif of oldNotifs) {
        const notifRef = doc(db, "notifications", userId, "items", notif.id);
        await updateDoc(notifRef, { deleted: true });
      }
    } catch (error) {
      console.error("Error clearing old notifications:", error);
    }
  }

  // Create typed notification helpers
  static async notifyFriendRequest(targetUserId, fromUserName) {
    await this.sendNotification(targetUserId, "friend_request", {
      title: "Friend Request",
      message: `${fromUserName} sent you a friend request!`
    });
  }

  static async notifyFriendRequestAccepted(targetUserId, fromUserName) {
    await this.sendNotification(targetUserId, "friend_request_accepted", {
      title: "Friend Request Accepted",
      message: `${fromUserName} accepted your friend request!`
    });
  }

  static async notifyMessage(targetUserId, fromUserName, messagePreview) {
    await this.sendNotification(targetUserId, "new_message", {
      title: "New Message",
      message: `${fromUserName}: ${messagePreview.substring(0, 50)}...`
    });
  }

  static async notifyIncomingCall(targetUserId, fromUserName) {
    await this.sendNotification(targetUserId, "incoming_call", {
      title: "Incoming Call",
      message: `${fromUserName} is calling you...`
    });
  }

  static async notifyMissedCall(targetUserId, fromUserName) {
    await this.sendNotification(targetUserId, "missed_call", {
      title: "Missed Call",
      message: `You missed a call from ${fromUserName}`
    });
  }
}

export default new NotificationManager();
