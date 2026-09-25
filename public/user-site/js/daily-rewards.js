// Daily Rewards and Tasks System
import { auth, db } from "./firebase-config.js";
import {
  doc,
  updateDoc,
  getDoc,
  increment,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

class DailyRewards {
  constructor() {
    this.tasks = {
      random_chat: {
        id: "random_chat",
        name: "Join Random Chat",
        description: "Chat with a random user",
        reward: 10,
        icon: "💬",
        completed: false
      },
      video_call: {
        id: "video_call",
        name: "Make a Video Call",
        description: "Start a video call with someone",
        reward: 15,
        icon: "📞",
        completed: false
      },
      join_group: {
        id: "join_group",
        name: "Join Group Chat",
        description: "Send a message in the group chat",
        reward: 5,
        icon: "👥",
        completed: false
      },
      complete_profile: {
        id: "complete_profile",
        name: "Complete Your Profile",
        description: "Add all required profile information",
        reward: 25,
        icon: "👤",
        completed: false
      },
      make_friend: {
        id: "make_friend",
        name: "Make a Friend",
        description: "Add someone as a friend",
        reward: 20,
        icon: "🤝",
        completed: false
      },
      get_review: {
        id: "get_review",
        name: "Receive Positive Review",
        description: "Get a positive review from someone you chatted with",
        reward: 30,
        icon: "⭐",
        completed: false
      },
      login: {
        id: "login",
        name: "Daily Login",
        description: "Log in to ConnectNow",
        reward: 5,
        icon: "🔓",
        completed: false
      }
    };
  }

  // Get today's date string
  getTodayString() {
    return new Date().toISOString().split("T")[0];
  }

  // Load today's tasks
  async loadTodaysTasks(userId) {
    const today = this.getTodayString();
    
    try {
      const tasksDocRef = doc(db, "dailyTasks", userId, "tasks", today);
      const tasksDoc = await getDoc(tasksDocRef);

      if (tasksDoc.exists()) {
        const completedTasks = tasksDoc.data().completed || {};
        
        // Update task completion status
        Object.keys(this.tasks).forEach(taskId => {
          this.tasks[taskId].completed = !!completedTasks[taskId];
        });
      } else {
        // Initialize today's tasks
        await this.initializeTodaysTasks(userId);
      }

      return this.tasks;
    } catch (error) {
      console.error("Error loading tasks:", error);
      return this.tasks;
    }
  }

  // Initialize today's tasks
  async initializeTodaysTasks(userId) {
    const today = this.getTodayString();
    
    try {
      const tasksDocRef = doc(db, "dailyTasks", userId, "tasks", today);
      await updateDoc(tasksDocRef, {
        date: today,
        completed: {},
        totalEarned: 0,
        createdAt: serverTimestamp()
      }).catch(() => {
        // Document doesn't exist, create it
        return addDoc(
          collection(db, "dailyTasks", userId, "tasks"),
          {
            date: today,
            completed: {},
            totalEarned: 0,
            createdAt: serverTimestamp()
          }
        );
      });
    } catch (error) {
      console.error("Error initializing tasks:", error);
    }
  }

  // Check task completion
  async checkTaskCompletion(userId, taskId) {
    if (!this.tasks[taskId]) {
      console.error("Invalid task ID:", taskId);
      return false;
    }

    const today = this.getTodayString();

    try {
      const tasksDocRef = doc(db, "dailyTasks", userId, "tasks", today);
      const tasksDoc = await getDoc(tasksDocRef);

      if (!tasksDoc.exists()) {
        await this.initializeTodaysTasks(userId);
      }

      const completedTasks = tasksDoc.data()?.completed || {};

      if (!completedTasks[taskId]) {
        // Mark as completed
        const reward = this.tasks[taskId].reward;

        // Update task
        await updateDoc(tasksDocRef, {
          [`completed.${taskId}`]: true,
          totalEarned: increment(reward)
        });

        // Add diamonds to user
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          diamonds: increment(reward)
        });

        // Record reward
        await addDoc(collection(db, "rewards"), {
          userId,
          taskId,
          reward,
          date: today,
          timestamp: serverTimestamp()
        });

        // Update local state
        this.tasks[taskId].completed = true;

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking task completion:", error);
      return false;
    }
  }

  // Get daily login reward
  async claimDailyLogin(userId) {
    return await this.checkTaskCompletion(userId, "login");
  }

  // Get total earned today
  async getTotalEarnedToday(userId) {
    const today = this.getTodayString();

    try {
      const tasksDocRef = doc(db, "dailyTasks", userId, "tasks", today);
      const tasksDoc = await getDoc(tasksDocRef);

      return tasksDoc.exists() ? tasksDoc.data().totalEarned || 0 : 0;
    } catch (error) {
      console.error("Error getting total earned:", error);
      return 0;
    }
  }

  // Get remaining tasks
  getRemainingTasks() {
    return Object.values(this.tasks).filter(task => !task.completed);
  }

  // Get completed tasks
  getCompletedTasks() {
    return Object.values(this.tasks).filter(task => task.completed);
  }

  // Get total possible reward
  getTotalPossibleReward() {
    return Object.values(this.tasks).reduce((sum, task) => sum + task.reward, 0);
  }

  // Format task info
  formatTaskInfo() {
    const completed = this.getCompletedTasks();
    const remaining = this.getRemainingTasks();
    const totalEarned = completed.reduce((sum, task) => sum + task.reward, 0);
    const totalPossible = this.getTotalPossibleReward();

    return {
      completed: completed.length,
      remaining: remaining.length,
      totalEarned,
      totalPossible,
      completedTasks: completed,
      remainingTasks: remaining,
      progress: Math.round((completed.length / Object.keys(this.tasks).length) * 100)
    };
  }

  // Reset tasks for new day (called at midnight)
  async resetTasks(userId) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split("T")[0];

    // Keep yesterday's data for history
    // Today's tasks will be created automatically when accessed

    // Mark login as incomplete for new day
    Object.keys(this.tasks).forEach(taskId => {
      this.tasks[taskId].completed = false;
    });
  }

  // Get reward history
  static async getRewardHistory(userId, days = 7) {
    try {
      const today = new Date();
      const dateRange = new Date();
      dateRange.setDate(dateRange.getDate() - days);

      const snapshot = await getDocs(
        query(
          collection(db, "rewards"),
          where("userId", "==", userId)
        )
      );

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(reward => reward.timestamp?.toDate() >= dateRange)
        .sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
    } catch (error) {
      console.error("Error getting reward history:", error);
      return [];
    }
  }

  // Get total diamonds earned this month
  static async getTotalEarnedThisMonth(userId) {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const snapshot = await getDocs(
        query(
          collection(db, "rewards"),
          where("userId", "==", userId)
        )
      );

      return snapshot.docs
        .filter(doc => doc.data().timestamp?.toDate() >= monthStart)
        .reduce((sum, doc) => sum + (doc.data().reward || 0), 0);
    } catch (error) {
      console.error("Error getting monthly total:", error);
      return 0;
    }
  }
}

export default new DailyRewards();
