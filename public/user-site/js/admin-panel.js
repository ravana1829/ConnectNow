// Admin Panel System
import { auth, db } from "./firebase-config.js";
import {
  doc,
  updateDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

class AdminPanel {
  constructor() {
    this.isAdmin = false;
    this.currentUser = null;
  }

  // Check if user is admin
  async checkAdminStatus() {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      this.isAdmin = userDoc.data()?.isAdmin || false;
      this.currentUser = user;

      return this.isAdmin;
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  }

  // Get all users
  async getAllUsers(limitCount = 100) {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      
      return snapshot.docs
        .map(doc => ({
          uid: doc.id,
          ...doc.data()
        }))
        .slice(0, limitCount);
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  }

  // Get user stats
  async getUserStats() {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const reportsSnapshot = await getDocs(collection(db, "reports"));
      const transactionsSnapshot = await getDocs(collection(db, "transactions"));

      const totalUsers = usersSnapshot.size;
      const onlineUsers = usersSnapshot.docs.filter(
        doc => doc.data().onlineStatus === "online"
      ).length;
      const totalReports = reportsSnapshot.size;
      const pendingReports = reportsSnapshot.docs.filter(
        doc => doc.data().status === "pending"
      ).length;
      const totalTransactions = transactionsSnapshot.size;
      const totalRevenue = transactionsSnapshot.docs.reduce(
        (sum, doc) => sum + (doc.data().amount || 0),
        0
      );

      return {
        totalUsers,
        onlineUsers,
        totalReports,
        pendingReports,
        totalTransactions,
        totalRevenue,
        avgTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0
      };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return null;
    }
  }

  // Get reported users
  async getReportedUsers() {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "reports"),
          orderBy("timestamp", "desc"),
          limit(100)
        )
      );

      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Group by reported user
      const grouped = {};
      for (const report of reports) {
        if (!grouped[report.reportedUser]) {
          grouped[report.reportedUser] = [];
        }
        grouped[report.reportedUser].push(report);
      }

      return grouped;
    } catch (error) {
      console.error("Error fetching reports:", error);
      return {};
    }
  }

  // Ban user
  async banUser(userId, reason = "") {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        banned: true,
        banReason: reason,
        bannedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error("Error banning user:", error);
      return false;
    }
  }

  // Unban user
  async unbanUser(userId) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        banned: false,
        banReason: "",
        bannedAt: null
      });

      return true;
    } catch (error) {
      console.error("Error unbanning user:", error);
      return false;
    }
  }

  // Delete user account
  async deleteUserAccount(userId) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        displayName: "Deleted User",
        email: `deleted-${userId}@connectnow.local`
      });

      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  // Mark report as resolved
  async markReportResolved(reportId, action = "") {
    try {
      const reportRef = doc(db, "reports", reportId);
      await updateDoc(reportRef, {
        status: "resolved",
        action,
        resolvedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error("Error resolving report:", error);
      return false;
    }
  }

  // Get transactions
  async getTransactions(limitCount = 100) {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "transactions"),
          orderBy("timestamp", "desc"),
          limit(limitCount)
        )
      );

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }
  }

  // Get revenue by date
  async getRevenueByDate(days = 30) {
    try {
      const allTransactions = await this.getTransactions(1000);
      const dateRange = new Date();
      dateRange.setDate(dateRange.getDate() - days);

      const filtered = allTransactions.filter(
        trans => trans.timestamp?.toDate() >= dateRange
      );

      const byDate = {};
      for (const trans of filtered) {
        const date = trans.timestamp?.toDate().toISOString().split("T")[0];
        if (!byDate[date]) {
          byDate[date] = { amount: 0, count: 0 };
        }
        byDate[date].amount += trans.amount || 0;
        byDate[date].count += 1;
      }

      return byDate;
    } catch (error) {
      console.error("Error calculating revenue:", error);
      return {};
    }
  }

  // Send system message to user
  async sendSystemMessage(userId, title, message) {
    try {
      await addDoc(collection(db, "notifications", userId, "items"), {
        type: "system_message",
        title,
        message,
        read: false,
        createdAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  }

  // Send announcement to all users
  async sendAnnouncementToAll(title, message) {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      
      let count = 0;
      for (const userDoc of usersSnapshot.docs) {
        await this.sendSystemMessage(userDoc.id, title, message);
        count++;
      }

      return count;
    } catch (error) {
      console.error("Error sending announcement:", error);
      return 0;
    }
  }

  // Get analytics
  async getAnalytics(days = 7) {
    try {
      const allUsers = await this.getAllUsers(10000);
      const dateRange = new Date();
      dateRange.setDate(dateRange.getDate() - days);

      const newUsers = allUsers.filter(user =>
        user.createdAt?.toDate() >= dateRange
      ).length;

      const activeUsers = allUsers.filter(user =>
        user.lastLogin?.toDate() >= dateRange
      ).length;

      const transactions = await this.getTransactions(10000);
      const revenue = transactions
        .filter(trans => trans.timestamp?.toDate() >= dateRange)
        .reduce((sum, trans) => sum + (trans.amount || 0), 0);

      return {
        totalUsers: allUsers.length,
        newUsers,
        activeUsers,
        revenue,
        transactionCount: transactions.length,
        averageSessionValue: transactions.length > 0 ? revenue / transactions.length : 0
      };
    } catch (error) {
      console.error("Error fetching analytics:", error);
      return null;
    }
  }

  // Create admin user (only for super admin setup)
  static async createAdminUser(userId) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isAdmin: true,
        adminSince: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error("Error creating admin:", error);
      return false;
    }
  }
}

export default new AdminPanel();
