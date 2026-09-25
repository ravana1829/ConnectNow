import { auth, db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { protectPage, currentUser, currentProfile, loadUserProfile } from "./auth-helper.js";

// Page Protection
protectPage();

// State
let selectedFriend = null;
let conversationId = null;
let conversations = [];
let friendsList = [];
let messageUnsubscribe = null;

const elements = {
  conversationList: document.getElementById("conversationList"),
  chatMessages: document.getElementById("chatMessages"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  chatHeader: document.getElementById("chatHeader"),
  chatUserName: document.getElementById("chatUserName"),
  chatUserStatus: document.getElementById("chatUserStatus"),
  chatUserAvatar: document.getElementById("chatUserAvatar"),
  newChatBtn: document.getElementById("newChatBtn"),
  newChatModal: document.getElementById("newChatModal"),
  searchFriendInput: document.getElementById("searchFriendInput"),
  friendsList: document.getElementById("friendsList"),
  logoutBtn: document.getElementById("logoutBtn"),
  videoChatBtn: document.getElementById("videoChatBtn"),
  clearChatBtn: document.getElementById("clearChatBtn"),
};

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserProfile(auth.currentUser);
  setupEventListeners();
  loadConversations();
  loadFriends();
});

function setupEventListeners() {
  elements.sendBtn.addEventListener("click", sendMessage);
  elements.messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  elements.newChatBtn.addEventListener("click", () => {
    elements.newChatModal.classList.remove("hidden");
  });
  elements.searchFriendInput.addEventListener("input", filterFriends);
  elements.logoutBtn.addEventListener("click", handleLogout);
  elements.videoChatBtn.addEventListener("click", startVideoCall);
  elements.clearChatBtn.addEventListener("click", clearConversation);

  // Close modal
  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modalId = e.target.dataset.modal;
      document.getElementById(modalId).classList.add("hidden");
    });
  });
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

    displayFriendsInModal();
  } catch (error) {
    console.error("Error loading friends:", error);
  }
}

function displayFriendsInModal() {
  elements.friendsList.innerHTML = friendsList.map((friend) => `
    <div class="friend-item" data-friend-id="${friend.id}">
      <img src="${friend.photoURL || './assets/default-avatar.png'}" alt="${friend.displayName}" class="friend-avatar" />
      <div class="friend-info">
        <h4>${friend.displayName}</h4>
        <p class="friend-status">${friend.onlineStatus || 'offline'}</p>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".friend-item").forEach((item) => {
    item.addEventListener("click", () => {
      const friendId = item.dataset.friendId;
      const friend = friendsList.find((f) => f.id === friendId);
      startNewChat(friend);
    });
  });
}

function filterFriends(e) {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll(".friend-item").forEach((item) => {
    const friendName = item.querySelector("h4").textContent.toLowerCase();
    item.style.display = friendName.includes(searchTerm) ? "flex" : "none";
  });
}

async function startNewChat(friend) {
  selectedFriend = friend;
  conversationId = await getOrCreateConversation(friend.id);
  elements.newChatModal.classList.add("hidden");
  updateChatHeader();
  loadMessages();
  elements.messageInput.focus();
}

async function getOrCreateConversation(friendId) {
  if (!currentUser) return null;

  const conversationId = [currentUser.uid, friendId].sort().join("_");

  try {
    const convDoc = await getDoc(doc(db, "conversations", conversationId));

    if (!convDoc.exists()) {
      // Create new conversation
      const friendDoc = await getDoc(doc(db, "users", friendId));
      const friendData = friendDoc.data();

      await updateDoc(doc(db, "conversations", conversationId), {
        participants: [currentUser.uid, friendId],
        participantNames: [currentProfile.displayName, friendData.displayName],
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageTime: serverTimestamp(),
      }).catch(() => {
        // Document doesn't exist, create it
        return addDoc(collection(db, "conversations"), {
          id: conversationId,
          participants: [currentUser.uid, friendId],
          participantNames: [currentProfile.displayName, friendData.displayName],
          createdAt: serverTimestamp(),
          lastMessage: null,
          lastMessageTime: serverTimestamp(),
        });
      });
    }
  } catch (error) {
    console.error("Error creating conversation:", error);
  }

  return conversationId;
}

async function loadConversations() {
  if (!currentUser) return;

  try {
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("lastMessageTime", "desc")
    );

    onSnapshot(q, (snapshot) => {
      conversations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      displayConversations();
    });
  } catch (error) {
    console.error("Error loading conversations:", error);
  }
}

function displayConversations() {
  elements.conversationList.innerHTML = conversations.map((conv) => {
    const otherUserId = conv.participants.find((id) => id !== currentUser.uid);
    const otherUserName = conv.participantNames.find(
      (_, idx) => conv.participants[idx] !== currentUser.uid
    );

    return `
      <div class="conversation-item ${conversationId === conv.id ? "active" : ""}" 
           data-conversation-id="${conv.id}" 
           data-friend-id="${otherUserId}">
        <div class="conversation-header">
          <h4>${otherUserName}</h4>
          <span class="timestamp">${formatTime(conv.lastMessageTime?.toDate())}</span>
        </div>
        <p class="last-message">${conv.lastMessage || "No messages yet"}</p>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const convId = item.dataset.conversationId;
      const friendId = item.dataset.friendId;
      const friend = friendsList.find((f) => f.id === friendId);

      if (friend) {
        selectedFriend = friend;
        conversationId = convId;
        updateChatHeader();
        loadMessages();
      }
    });
  });
}

function updateChatHeader() {
  if (!selectedFriend) return;

  elements.chatUserName.textContent = selectedFriend.displayName;
  elements.chatUserStatus.textContent = selectedFriend.onlineStatus || "offline";
  elements.chatUserAvatar.src = selectedFriend.photoURL || "./assets/default-avatar.png";
  elements.messageInput.disabled = false;
  elements.sendBtn.disabled = false;
}

function loadMessages() {
  if (!conversationId) return;

  if (messageUnsubscribe) messageUnsubscribe();

  const messagesPath = `conversations/${conversationId}/messages`;
  const q = query(
    collection(db, messagesPath),
    orderBy("timestamp", "asc"),
    limit(50)
  );

  messageUnsubscribe = onSnapshot(q, (snapshot) => {
    displayMessages(snapshot.docs);
    // Auto-scroll to bottom
    setTimeout(() => {
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }, 100);
  });
}

function displayMessages(docs) {
  elements.chatMessages.innerHTML = docs.map((doc) => {
    const msg = doc.data();
    const isOwn = msg.senderId === currentUser.uid;

    return `
      <div class="message ${isOwn ? "own" : "other"}">
        <div class="message-bubble">
          <p>${escapeHtml(msg.text)}</p>
          <span class="message-time">${formatTime(msg.timestamp?.toDate())}</span>
        </div>
      </div>
    `;
  }).join("");
}

async function sendMessage() {
  const text = elements.messageInput.value.trim();
  if (!text || !conversationId || !currentUser) return;

  elements.messageInput.value = "";

  try {
    const messagesPath = `conversations/${conversationId}/messages`;
    await addDoc(collection(db, messagesPath), {
      senderId: currentUser.uid,
      senderName: currentProfile.displayName,
      text: text,
      timestamp: serverTimestamp(),
      read: false,
    });

    // Update conversation last message
    await updateDoc(doc(db, "conversations", conversationId), {
      lastMessage: text.substring(0, 50),
      lastMessageTime: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error sending message:", error);
    alert("Failed to send message");
  }
}

async function startVideoCall() {
  if (!selectedFriend) return;
  // Navigate to private video call page with friend ID
  window.location.href = `private-video.html?friendId=${selectedFriend.id}`;
}

async function clearConversation() {
  if (!conversationId || !confirm("Clear this conversation?")) return;

  try {
    const messagesPath = `conversations/${conversationId}/messages`;
    const snapshot = await getDocs(collection(db, messagesPath));
    
    for (const doc of snapshot.docs) {
      await deleteDoc(doc.ref);
    }

    alert("Conversation cleared");
  } catch (error) {
    console.error("Error clearing conversation:", error);
  }
}

async function handleLogout() {
  import("./auth-helper.js").then((module) => {
    module.handleLogout();
  });
}

function formatTime(date) {
  if (!date) return "";
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
