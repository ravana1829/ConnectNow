import { auth, db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { protectPage, currentUser, currentProfile, loadUserProfile } from "./auth-helper.js";

// Page Protection
protectPage();

// State
let selectedUser = null;
let pendingRequests = [];
let friendsList = [];
let allUsers = [];

const elements = {
  requestsTab: document.getElementById("requestsTab"),
  friendsTab: document.getElementById("friendsTab"),
  searchTab: document.getElementById("searchTab"),
  requestsList: document.getElementById("requestsList"),
  friendsList: document.getElementById("friendsList"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  searchResults: document.getElementById("searchResults"),
  requestsCount: document.getElementById("requestsCount"),
  friendsCount: document.getElementById("friendsCount"),
  profileModal: document.getElementById("profileModal"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileName: document.getElementById("profileName"),
  profileStatus: document.getElementById("profileStatus"),
  chatBtn: document.getElementById("chatBtn"),
  callBtn: document.getElementById("callBtn"),
  removeFriendBtn: document.getElementById("removeFriendBtn"),
  viewProfileBtn: document.getElementById("viewProfileBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
};

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserProfile(auth.currentUser);
  setupEventListeners();
  loadFriendRequests();
  loadFriends();
  loadAllUsers();
});

function setupEventListeners() {
  // Tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Search
  elements.searchBtn.addEventListener("click", performSearch);
  elements.searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") performSearch();
  });

  // Modal actions
  elements.chatBtn.addEventListener("click", () => {
    if (selectedUser) {
      window.location.href = `/private-chat.html?friendId=${selectedUser.id}`;
    }
  });

  elements.callBtn.addEventListener("click", () => {
    if (selectedUser) {
      window.location.href = `/private-video.html?friendId=${selectedUser.id}`;
    }
  });

  elements.removeFriendBtn.addEventListener("click", removeFriend);
  elements.viewProfileBtn.addEventListener("click", () => {
    if (selectedUser) {
      window.location.href = `/profile.html?userId=${selectedUser.id}`;
    }
  });

  elements.logoutBtn.addEventListener("click", handleLogout);

  // Modal close
  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modalId = e.target.dataset.modal;
      document.getElementById(modalId).classList.add("hidden");
    });
  });

  // Close modal on background click
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  });
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Remove active from buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Show selected tab
  document.getElementById(`${tabName}Tab`).classList.add("active");
  event.target.closest(".tab-btn").classList.add("active");
}

async function loadFriendRequests() {
  if (!currentUser) return;

  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.data() || {};
    const requestIds = userData.friendRequests || [];

    const requestDocs = await Promise.all(
      requestIds.map((id) => getDoc(doc(db, "users", id)))
    );

    pendingRequests = requestDocs
      .filter((doc) => doc.exists())
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    displayFriendRequests();
    elements.requestsCount.textContent = pendingRequests.length;
  } catch (error) {
    console.error("Error loading friend requests:", error);
  }
}

function displayFriendRequests() {
  if (pendingRequests.length === 0) {
    elements.requestsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No pending friend requests</p>
      </div>
    `;
    return;
  }

  elements.requestsList.innerHTML = pendingRequests.map((user) => `
    <div class="request-card" data-user-id="${user.id}">
      <img src="${user.photoURL || './assets/default-avatar.png'}" alt="${user.displayName}" class="request-avatar" />
      <div class="request-info">
        <h4>${user.displayName}</h4>
        <p class="request-status">${user.onlineStatus || 'offline'}</p>
      </div>
      <div class="request-actions">
        <button class="btn btn-sm btn-success accept-btn" data-user-id="${user.id}">Accept</button>
        <button class="btn btn-sm btn-danger reject-btn" data-user-id="${user.id}">Reject</button>
      </div>
    </div>
  `).join("");

  // Add event listeners
  document.querySelectorAll(".accept-btn").forEach((btn) => {
    btn.addEventListener("click", () => acceptFriendRequest(btn.dataset.userId));
  });

  document.querySelectorAll(".reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => rejectFriendRequest(btn.dataset.userId));
  });

  document.querySelectorAll(".request-card").forEach((card) => {
    card.addEventListener("click", () => {
      const userId = card.dataset.userId;
      const user = pendingRequests.find((u) => u.id === userId);
      if (user) showUserModal(user);
    });
  });
}

async function acceptFriendRequest(userId) {
  try {
    // Add to current user's friends
    await updateDoc(doc(db, "users", currentUser.uid), {
      friends: arrayUnion(userId),
      friendRequests: arrayRemove(userId),
    });

    // Add to other user's friends
    await updateDoc(doc(db, "users", userId), {
      friends: arrayUnion(currentUser.uid),
      sentRequests: arrayRemove(currentUser.uid),
    });

    // Reload data
    loadFriendRequests();
    loadFriends();
  } catch (error) {
    console.error("Error accepting friend request:", error);
    alert("Failed to accept request");
  }
}

async function rejectFriendRequest(userId) {
  try {
    // Remove from friend requests
    await updateDoc(doc(db, "users", currentUser.uid), {
      friendRequests: arrayRemove(userId),
    });

    // Remove from sent requests
    await updateDoc(doc(db, "users", userId), {
      sentRequests: arrayRemove(currentUser.uid),
    });

    // Reload data
    loadFriendRequests();
  } catch (error) {
    console.error("Error rejecting friend request:", error);
    alert("Failed to reject request");
  }
}

async function loadFriends() {
  if (!currentUser) return;

  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.data() || {};
    const friendIds = userData.friends || [];

    const friendDocs = await Promise.all(
      friendIds.map((id) => getDoc(doc(db, "users", id)))
    );

    friendsList = friendDocs
      .filter((doc) => doc.exists())
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    displayFriends();
    elements.friendsCount.textContent = friendsList.length;
  } catch (error) {
    console.error("Error loading friends:", error);
  }
}

function displayFriends() {
  if (friendsList.length === 0) {
    elements.friendsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">👥</span>
        <p>You don't have any friends yet</p>
        <p class="empty-subtext">Add friends to start chatting!</p>
      </div>
    `;
    return;
  }

  elements.friendsList.innerHTML = friendsList.map((friend) => `
    <div class="friend-card" data-friend-id="${friend.id}">
      <img src="${friend.photoURL || './assets/default-avatar.png'}" alt="${friend.displayName}" class="friend-avatar" />
      <div class="friend-card-info">
        <h4>${friend.displayName}</h4>
        <span class="friend-status ${friend.onlineStatus || 'offline'}">${friend.onlineStatus || 'offline'}</span>
      </div>
      <div class="friend-card-actions">
        <button class="friend-action-btn chat-btn" title="Chat">💬</button>
        <button class="friend-action-btn call-btn" title="Call">📞</button>
      </div>
    </div>
  `).join("");

  // Add event listeners
  document.querySelectorAll(".friend-card").forEach((card) => {
    card.addEventListener("click", () => {
      const friendId = card.dataset.friendId;
      const friend = friendsList.find((f) => f.id === friendId);
      if (friend) showUserModal(friend);
    });
  });

  document.querySelectorAll(".chat-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const friendId = btn.closest(".friend-card").dataset.friendId;
      window.location.href = `/private-chat.html?friendId=${friendId}`;
    });
  });

  document.querySelectorAll(".call-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const friendId = btn.closest(".friend-card").dataset.friendId;
      window.location.href = `/private-video.html?friendId=${friendId}`;
    });
  });
}

async function loadAllUsers() {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    allUsers = snapshot.docs
      .filter((doc) => doc.id !== currentUser.uid)
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  } catch (error) {
    console.error("Error loading all users:", error);
  }
}

async function performSearch() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();
  if (!searchTerm) {
    elements.searchResults.innerHTML = `
      <div class="search-placeholder">
        <span class="search-icon">🔍</span>
        <p>Search for users to add as friends</p>
      </div>
    `;
    return;
  }

  try {
    // Search in all users
    const results = allUsers.filter((user) =>
      user.displayName.toLowerCase().includes(searchTerm) ||
      (user.email && user.email.toLowerCase().includes(searchTerm))
    );

    if (results.length === 0) {
      elements.searchResults.innerHTML = `
        <div class="search-placeholder">
          <span class="search-icon">❌</span>
          <p>No users found matching "${searchTerm}"</p>
        </div>
      `;
      return;
    }

    displaySearchResults(results);
  } catch (error) {
    console.error("Error performing search:", error);
  }
}

function displaySearchResults(results) {
  elements.searchResults.innerHTML = results.map((user) => {
    const isFriend = friendsList.some((f) => f.id === user.id);
    const hasRequest = pendingRequests.some((r) => r.id === user.id);
    let actionButton = "";

    if (isFriend) {
      actionButton = '<span class="badge friend-badge">Friends</span>';
    } else if (hasRequest) {
      actionButton = '<span class="badge request-badge">Pending</span>';
    } else {
      actionButton = `<button class="btn btn-sm btn-primary add-btn" data-user-id="${user.id}">+ Add</button>`;
    }

    return `
      <div class="search-result-card" data-user-id="${user.id}">
        <img src="${user.photoURL || './assets/default-avatar.png'}" alt="${user.displayName}" class="result-avatar" />
        <div class="result-info">
          <h4>${user.displayName}</h4>
          <p class="result-status">${user.onlineStatus || 'offline'}</p>
        </div>
        <div class="result-action">
          ${actionButton}
        </div>
      </div>
    `;
  }).join("");

  // Add event listeners
  document.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => sendFriendRequest(btn.dataset.userId));
  });

  document.querySelectorAll(".search-result-card").forEach((card) => {
    card.addEventListener("click", () => {
      const userId = card.dataset.userId;
      const user = results.find((u) => u.id === userId);
      if (user) showUserModal(user);
    });
  });
}

async function sendFriendRequest(userId) {
  try {
    // Add to recipient's friend requests
    await updateDoc(doc(db, "users", userId), {
      friendRequests: arrayUnion(currentUser.uid),
    });

    // Track sent request on current user
    await updateDoc(doc(db, "users", currentUser.uid), {
      sentRequests: arrayUnion(userId),
    });

    alert("Friend request sent!");
    performSearch(); // Refresh results
  } catch (error) {
    console.error("Error sending friend request:", error);
    alert("Failed to send friend request");
  }
}

function showUserModal(user) {
  selectedUser = user;
  const isFriend = friendsList.some((f) => f.id === user.id);

  elements.profileAvatar.src = user.photoURL || "./assets/default-avatar.png";
  elements.profileName.textContent = user.displayName;
  elements.profileStatus.textContent = user.onlineStatus || "offline";

  // Show/hide remove friend button
  elements.removeFriendBtn.classList.toggle("hidden", !isFriend);

  elements.profileModal.classList.remove("hidden");
}

async function removeFriend() {
  if (!selectedUser) return;

  if (!confirm(`Remove ${selectedUser.displayName} from friends?`)) return;

  try {
    // Remove from current user's friends
    await updateDoc(doc(db, "users", currentUser.uid), {
      friends: arrayRemove(selectedUser.id),
    });

    // Remove from other user's friends
    await updateDoc(doc(db, "users", selectedUser.id), {
      friends: arrayRemove(currentUser.uid),
    });

    elements.profileModal.classList.add("hidden");
    loadFriends();
  } catch (error) {
    console.error("Error removing friend:", error);
    alert("Failed to remove friend");
  }
}

async function handleLogout() {
  import("./auth-helper.js").then((module) => {
    module.handleLogout();
  });
}
