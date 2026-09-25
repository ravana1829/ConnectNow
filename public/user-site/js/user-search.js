// User Search System
import { auth, db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

class UserSearch {
  constructor() {
    this.searchHistory = [];
    this.results = [];
  }

  // Search users by name or email
  async searchUsers(searchTerm, limit = 20) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    const currentUserId = auth.currentUser.uid;
    const searchLower = searchTerm.toLowerCase();

    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      
      let results = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const uid = doc.id;

        // Skip self
        if (uid === currentUserId) return;

        // Search by display name or email
        const nameMatch = userData.displayName?.toLowerCase().includes(searchLower);
        const emailMatch = userData.email?.toLowerCase().includes(searchLower);

        if (nameMatch || emailMatch) {
          results.push({
            uid,
            displayName: userData.displayName,
            email: userData.email,
            photoURL: userData.photoURL,
            onlineStatus: userData.onlineStatus,
            lastSeen: userData.lastSeen,
            isFriend: userData.friends?.includes(currentUserId) || false,
            sentRequest: userData.sentRequests?.includes(currentUserId) || false,
            receivedRequest: userData.friendRequests?.includes(currentUserId) || false
          });
        }
      });

      // Sort by name match first, then online status
      results.sort((a, b) => {
        const aNameMatch = a.displayName?.toLowerCase().startsWith(searchLower) ? 1 : 0;
        const bNameMatch = b.displayName?.toLowerCase().startsWith(searchLower) ? 1 : 0;
        
        if (aNameMatch !== bNameMatch) {
          return bNameMatch - aNameMatch;
        }

        if (a.onlineStatus === "online" && b.onlineStatus !== "online") return -1;
        if (a.onlineStatus !== "online" && b.onlineStatus === "online") return 1;

        return 0;
      });

      this.results = results.slice(0, limit);
      this.saveSearchHistory(searchTerm);

      return this.results;
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  }

  // Save search history
  saveSearchHistory(searchTerm) {
    if (!this.searchHistory.includes(searchTerm)) {
      this.searchHistory.unshift(searchTerm);
      if (this.searchHistory.length > 10) {
        this.searchHistory.pop();
      }
    }
  }

  // Get search history
  getSearchHistory() {
    return this.searchHistory;
  }

  // Clear search history
  clearSearchHistory() {
    this.searchHistory = [];
  }

  // Get user details
  async getUserDetails(userId) {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        return {
          uid: userId,
          ...userDoc.data()
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting user details:", error);
      return null;
    }
  }

  // Get last search results
  getLastResults() {
    return this.results;
  }
}

export default new UserSearch();
