import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";


import {
  collection,
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


import {
  auth,
  db
} from "./firebase-config.js";


/* =========================================================
   CONFIG
========================================================= */

const SERVER_URL =
  window.CONNECTNOW_SERVER_URL ||
  "https://connectnow-n26j.onrender.com";


const COMMUNITY_GROUP_ID =
  "connectnow-community";


/* =========================================================
   SOCKET
========================================================= */

let socket = null;


/* =========================================================
   USER
========================================================= */

let currentUser = null;


let currentProfile = {

  displayName:
    "ConnectNow User",

  photoURL:
    "",

  bio:
    "ConnectNow user",

  friendIds:
    []

};


/* =========================================================
   GROUP
========================================================= */

let currentGroupId =
  COMMUNITY_GROUP_ID;


let currentGroupName =
  "ConnectNow Community";


let currentGroupDescription =
  "Public ConnectNow community";


/* =========================================================
   MEMBERS
========================================================= */

let groupMembers = [];


let selectedMember =
  null;


let friendsOnly =
  false;


/* =========================================================
   TYPING
========================================================= */

let typingTimer =
  null;


/* =========================================================
   ADMIN PUBLIC LIVE
========================================================= */

let localLiveStream =
  null;


let isLiveHost =
  false;


const livePeers =
  new Map();


const remoteStreams =
  new Map();


/* =========================================================
   ADMIN TOKEN
========================================================= */

let adminToken =
  sessionStorage.getItem(
    "connectnowAdminToken"
  ) || "";


/* =========================================================
   PRIVATE VIDEO
========================================================= */

let privateLiveActive =
  false;


let privateRole =
  "";


let privateRemoteSocketId =
  null;


let privatePeer =
  null;


let privateLocalStream =
  null;


let privateRemoteStream =
  null;


/* =========================================================
   DOM
========================================================= */

const $ =
  (id) =>
    document.getElementById(id);


/* =========================================================
   TOAST
========================================================= */

function toast(
  message
) {

  const el =
    $("toast");


  if (!el)
    return;


  el.textContent =
    message;


  el.classList.add(
    "show"
  );


  clearTimeout(
    toast.timer
  );


  toast.timer =
    setTimeout(
      () => {

        el.classList.remove(
          "show"
        );

      },
      2500
    );

}


/* =========================================================
   AVATAR
========================================================= */

function avatarUrl(
  name,
  photoURL
) {

  if (photoURL) {

    return photoURL;

  }


  return (
    "https://ui-avatars.com/api/" +
    "?name=" +
    encodeURIComponent(
      name || "User"
    ) +
    "&background=7b4ce2" +
    "&color=ffffff"
  );

}


/* =========================================================
   PROFILE LOAD
========================================================= */

async function loadProfile() {

  if (!currentUser)
    return;


  const defaultName =
    currentUser.displayName ||
    currentUser.email?.split("@")[0] ||
    "ConnectNow User";


  currentProfile = {

    displayName:
      defaultName,

    photoURL:
      currentUser.photoURL ||
      "",

    bio:
      "ConnectNow user",

    friendIds:
      []

  };


  try {

    const userRef =
      doc(
        db,
        "users",
        currentUser.uid
      );


    const snap =
      await getDoc(
        userRef
      );


    if (snap.exists()) {

      const data =
        snap.data();


      currentProfile = {

        displayName:
          data.displayName ||
          defaultName,

        photoURL:
          data.photoURL ||
          currentUser.photoURL ||
          "",

        bio:
          data.bio ||
          "ConnectNow user",

        friendIds:
          Array.isArray(
            data.friendIds
          )
            ? data.friendIds
            : []

      };

    }

  } catch (error) {

    console.warn(
      "Profile load error:",
      error
    );

  }


  updateProfileUI();

}


/* =========================================================
   PROFILE UI
========================================================= */

function updateProfileUI() {

  const image =
    avatarUrl(
      currentProfile.displayName,
      currentProfile.photoURL
    );


  if ($("headerProfileImage")) {

    $("headerProfileImage").src =
      image;

  }


  if ($("leftProfileImage")) {

    $("leftProfileImage").src =
      image;

  }


  if ($("leftProfileName")) {

    $("leftProfileName").textContent =
      currentProfile.displayName;

  }

}


/* =========================================================
   SOCKET CONNECT
========================================================= */

function connectSocket() {

  if (socket)
    return;


  socket =
    io(
      SERVER_URL,
      {
        transports: [
          "websocket",
          "polling"
        ]
      }
    );


  socket.on(
    "connect",
    () => {

      setConnectionStatus(
        "Connected",
        "connected"
      );


      registerSocket();


      joinCurrentGroup();

    }
  );


  socket.on(
    "disconnect",
    () => {

      setConnectionStatus(
        "Chat server disconnected",
        "error"
      );

    }
  );


  socket.on(
    "connect_error",
    (error) => {

      console.error(
        "Socket error:",
        error
      );


      setConnectionStatus(
        "Unable to connect to chat server",
        "error"
      );

    }
  );


  /* GROUP JOIN */

  socket.on(
    "groupJoined",
    (data) => {

      if (
        data.roomId !==
        currentGroupId
      ) {

        return;

      }


      groupMembers =
        data.members || [];


      renderMembers();


      updateMemberCount();


      setConnectionStatus(
        "Connected • " +
        currentGroupName,
        "connected"
      );

    }
  );


  socket.on(
    "groupChatJoined",
    (data) => {

      if (
        data.roomId !==
        currentGroupId
      ) {

        return;

      }


      groupMembers =
        data.members || [];


      renderMembers();


      updateMemberCount();

    }
  );


  /* MEMBER UPDATE */

  socket.on(
    "groupMembersUpdated",
    (data) => {

      if (
        data.roomId !==
        currentGroupId
      ) {

        return;

      }


      groupMembers =
        data.members || [];


      renderMembers();


      updateMemberCount();

    }
  );


  socket.on(
    "userJoinedGroup",
    (user) => {

      toast(
        `${user.displayName || "User"} joined`
      );

    }
  );


  socket.on(
    "userLeftGroup",
    (user) => {

      toast(
        `${user.displayName || "User"} left`
      );

    }
  );


  /* MESSAGE */

  socket.on(
    "receiveGroupMessage",
    (data) => {

      if (
        data.roomId &&
        data.roomId !==
          currentGroupId
      ) {

        return;

      }


      renderRealtimeMessage(
        data
      );

    }
  );


  /* TYPING */

  socket.on(
    "groupTyping",
    (data) => {

      if (
        data.userId ===
        currentUser?.uid
      ) {

        return;

      }


      const indicator =
        $("typingIndicator");


      if (!indicator)
        return;


      if (data.typing) {

        indicator.textContent =
          `${data.displayName || "Someone"} is typing...`;


        indicator.classList.remove(
          "hidden"
        );

      } else {

        indicator.classList.add(
          "hidden"
        );

      }

    }
  );


  /* GENERAL ERROR */

  socket.on(
    "serverError",
    (data) => {

      toast(
        data?.message ||
        "Server error"
      );

    }
  );


  /* ADMIN */

  socket.on(
    "adminRequired",
    () => {

      adminToken =
        "";


      sessionStorage.removeItem(
        "connectnowAdminToken"
      );


      if (isLiveHost) {

        stopLocalLive(
          false
        );

      }


      openAdminLogin();

    }
  );


  /* PRIVATE VIDEO */

  setupPrivateVideoSocketEvents();


  /* ADMIN LIVE */

  setupLiveSocketEvents();

}


/* =========================================================
   REGISTER
========================================================= */

function registerSocket() {

  if (
    !socket ||
    !socket.connected
  ) {

    return;

  }


  socket.emit(
    "register",
    {

      userId:
        currentUser?.uid ||
        socket.id,

      displayName:
        currentProfile.displayName,

      gender:
        "unknown"

    }
  );

}


/* =========================================================
   STATUS
========================================================= */

function setConnectionStatus(
  text,
  type = ""
) {

  const el =
    $("connectionStatus");


  if (!el)
    return;


  el.textContent =
    text;


  el.className =
    "connection-status";


  if (type) {

    el.classList.add(
      type
    );

  }

}


/* =========================================================
   JOIN GROUP
========================================================= */

function joinCurrentGroup() {

  if (
    !socket ||
    !socket.connected
  ) {

    return;

  }


  socket.emit(
    "joinGroupChat",
    {
      roomId:
        currentGroupId
    }
  );

}


/* =========================================================
   GROUP LIST
========================================================= */

function setupGroupList() {

  const list =
    $("groupList");


  if (!list)
    return;


  list.addEventListener(
    "click",
    (event) => {

      const item =
        event.target.closest(
          ".group-item"
        );


      if (!item)
        return;


      selectGroup(
        item.dataset.groupId,
        item.dataset.groupName ||
          "ConnectNow Community",
        item.dataset.groupDescription ||
          "Public ConnectNow community"
      );

    }
  );

}


/* =========================================================
   SELECT GROUP
========================================================= */

function selectGroup(
  groupId,
  name,
  description
) {

  if (!groupId)
    return;


  currentGroupId =
    groupId;


  currentGroupName =
    name;


  currentGroupDescription =
    description;


  document
    .querySelectorAll(
      ".group-item"
    )
    .forEach(
      (item) => {

        item.classList.toggle(
          "active",
          item.dataset.groupId ===
            groupId
        );

      }
    );


  if ($("chatRoomName")) {

    $("chatRoomName").textContent =
      name;

  }


  if ($("chatRoomDescription")) {

    $("chatRoomDescription").textContent =
      description;

  }


  if ($("chatRoomAvatar")) {

    const initials =
      name
        .split(/\s+/)
        .slice(0, 2)
        .map(
          (word) =>
            word[0]?.toUpperCase() ||
            ""
        )
        .join("");


    $("chatRoomAvatar").textContent =
      initials ||
      "CN";

  }


  clearMessages();


  groupMembers =
    [];


  renderMembers();


  joinCurrentGroup();

}


/* =========================================================
   CLEAR MESSAGES
========================================================= */

function clearMessages() {

  const box =
    $("chatMessages");


  if (!box)
    return;


  box.innerHTML =

    `
      <div class="empty-state">

        <div class="empty-state-icon">
          💬
        </div>

        <h3>
          Welcome to ConnectNow
        </h3>

        <p>
          Start a conversation with people in this group.
        </p>

      </div>
    `;

}


/* =========================================================
   MESSAGE RENDER
========================================================= */

function renderRealtimeMessage(
  data
) {

  const box =
    $("chatMessages");


  if (!box)
    return;


  const empty =
    box.querySelector(
      ".empty-state"
    );


  if (empty)
    empty.remove();


  const mine =
    String(
      data.userId
    ) ===
    String(
      currentUser?.uid
    );


  const row =
    document.createElement(
      "div"
    );


  row.className =
    "message-row";


  if (mine) {

    row.classList.add(
      "mine"
    );

  }


  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    "message-wrapper";


  const name =
    document.createElement(
      "div"
    );


  name.className =
    "message-name";


  name.textContent =
    data.displayName ||
    "ConnectNow User";


  const bubble =
    document.createElement(
      "div"
    );


  bubble.className =
    "message-bubble";


  bubble.textContent =
    data.message ||
    "";


  const time =
    document.createElement(
      "div"
    );


  time.className =
    "message-time";


  time.textContent =
    new Date(
      data.timestamp ||
      Date.now()
    ).toLocaleTimeString(
      [],
      {
        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    );


  wrapper.appendChild(
    name
  );


  wrapper.appendChild(
    bubble
  );


  wrapper.appendChild(
    time
  );


  row.appendChild(
    wrapper
  );


  box.appendChild(
    row
  );


  box.scrollTop =
    box.scrollHeight;

}


/* =========================================================
   SEND MESSAGE
========================================================= */

function sendGroupMessage() {

  const input =
    $("messageInput");


  if (!input)
    return;


  const text =
    input.value.trim();


  if (!text)
    return;


  if (
    !socket ||
    !socket.connected
  ) {

    toast(
      "Chat server is not connected"
    );


    return;

  }


  socket.emit(
    "sendGroupMessage",
    {

      roomId:
        currentGroupId,

      userId:
        currentUser?.uid ||
        socket.id,

      displayName:
        currentProfile.displayName,

      message:
        text

    }
  );


  input.value =
    "";


  input.focus();


  socket.emit(
    "groupTyping",
    {

      roomId:
        currentGroupId,

      typing:
        false

    }
  );

}


/* =========================================================
   COMPOSER
========================================================= */

function setupComposer() {

  $("sendMessageBtn")
    ?.addEventListener(
      "click",
      sendGroupMessage
    );


  $("messageInput")
    ?.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key ===
            "Enter" &&
          !event.shiftKey
        ) {

          event.preventDefault();

          sendGroupMessage();

        }

      }
    );


  $("messageInput")
    ?.addEventListener(
      "input",
      () => {

        if (!socket)
          return;


        socket.emit(
          "groupTyping",
          {

            roomId:
              currentGroupId,

            typing:
              true

          }
        );


        clearTimeout(
          typingTimer
        );


        typingTimer =
          setTimeout(
            () => {

              socket.emit(
                "groupTyping",
                {

                  roomId:
                    currentGroupId,

                  typing:
                    false

                }
              );

            },
            800
          );

      }
    );

}


/* =========================================================
   MEMBER SORT
========================================================= */

function sortMembers(
  members
) {

  const me =
    String(
      currentUser?.uid ||
      ""
    );


  return [
    ...members
  ].sort(
    (a, b) => {

      const aMe =
        String(
          a.userId
        ) === me;


      const bMe =
        String(
          b.userId
        ) === me;


      /* CURRENT USER ALWAYS FIRST */

      if (aMe && !bMe)
        return -1;


      if (!aMe && bMe)
        return 1;


      /* LIVE USERS SECOND */

      const aLive =
        Boolean(
          a.privateLive
        );


      const bLive =
        Boolean(
          b.privateLive
        );


      if (
        aLive &&
        !bLive
      ) {

        return -1;

      }


      if (
        !aLive &&
        bLive
      ) {

        return 1;

      }


      /* LIVE + NORMAL USERS ALPHABETICAL */

      return String(
        a.displayName ||
        ""
      ).localeCompare(
        String(
          b.displayName ||
          ""
        ),
        undefined,
        {
          sensitivity:
            "base"
        }
      );

    }
  );

}


/* =========================================================
   RENDER MEMBERS
========================================================= */

function renderMembers() {

  const list =
    $("membersList");


  if (!list)
    return;


  list.innerHTML =
    "";


  const search =
    $("memberSearchInput")
      ?.value
      .trim()
      .toLowerCase() ||
    "";


  let filtered =
    sortMembers(
      groupMembers
    );


  if (friendsOnly) {

    filtered =
      filtered.filter(
        (user) => {

          return (
            currentProfile.friendIds ||
            []
          ).includes(
            user.userId
          );

        }
      );

  }


  if (search) {

    filtered =
      filtered.filter(
        (user) =>
          String(
            user.displayName ||
            ""
          )
            .toLowerCase()
            .includes(
              search
            )
      );

  }


  filtered.forEach(
    (user) => {

      const isMe =
        String(
          user.userId
        ) ===
        String(
          currentUser?.uid
        );


      const isLive =
        Boolean(
          user.privateLive
        );


      const item =
        document.createElement(
          "div"
        );


      item.className =
        "cn-member-item";


      if (isMe) {

        item.classList.add(
          "owner-row"
        );

      }


      if (
        isLive &&
        !isMe
      ) {

        item.classList.add(
          "live-row"
        );

      }


      /* AVATAR */

      const avatarWrap =
        document.createElement(
          "div"
        );


      avatarWrap.className =
        "cn-member-avatar-wrap";


      const avatar =
        document.createElement(
          "img"
        );


      avatar.className =
        "cn-member-avatar";


      avatar.src =
        avatarUrl(
          user.displayName,
          user.photoURL || ""
        );


      const online =
        document.createElement(
          "span"
        );


      online.className =
        "cn-member-online";


      avatarWrap.appendChild(
        avatar
      );


      avatarWrap.appendChild(
        online
      );


      /* INFO */

      const info =
        document.createElement(
          "div"
        );


      info.className =
        "cn-member-info";


      const name =
        document.createElement(
          "div"
        );


      name.className =
        "cn-member-name";


      name.textContent =
        user.displayName ||
        "ConnectNow User";


      const status =
        document.createElement(
          "div"
        );


      status.className =
        "cn-member-status";


      if (isMe) {

        status.textContent =
          isLive
            ? "You • Live"
            : "You • Online";

      } else if (isLive) {

        status.textContent =
          "Private live • Click 🎥";

      } else {

        status.textContent =
          "Online";

      }


      info.appendChild(
        name
      );


      info.appendChild(
        status
      );


      /* ACTIONS */

      const actions =
        document.createElement(
          "div"
        );


      actions.className =
        "cn-member-actions";


      if (isMe) {

        /* CURRENT USER:
           NO CHAT BUTTON
           VIDEO ONLY
        */

        const videoBtn =
          document.createElement(
            "button"
          );


        videoBtn.className =
          "member-action-btn owner-video";


        if (isLive) {

          videoBtn.classList.add(
            "video-active"
          );

          videoBtn.textContent =
            "🔴";

          videoBtn.title =
            "Stop my private live";

        } else {

          videoBtn.textContent =
            "🎥";

          videoBtn.title =
            "Start my private video";

        }


        videoBtn.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();


            if (isLive) {

              stopPrivateLive();

            } else {

              startPrivateLive();

            }

          }
        );


        actions.appendChild(
          videoBtn
        );

      } else {

        /* OTHER USERS:
           CHAT + CALL / PRIVATE VIDEO
        */

        const chatBtn =
          document.createElement(
            "button"
          );


        chatBtn.className =
          "member-action-btn";


        chatBtn.textContent =
          "💬";


        chatBtn.title =
          "Chat";


        chatBtn.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();

            // FIXED: Wire up to actual private chat
            sessionStorage.setItem("privateChatUserId", user.uid);
            sessionStorage.setItem("privateChatUserName", user.displayName);
            sessionStorage.setItem("privateChatUserPhoto", user.photoURL || "");
            window.location.href = "./private-chat.html";

          }
        );


        const videoBtn =
          document.createElement(
            "button"
          );


        videoBtn.className =
          "member-action-btn";


        if (isLive) {

          videoBtn.classList.add(
            "video-active"
          );


          videoBtn.textContent =
            "🎥";


          videoBtn.title =
            "Watch private live";

        } else {

          videoBtn.textContent =
            "📞";


          videoBtn.title =
            "Private video call";

        }


        videoBtn.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();


            if (isLive) {

              requestPrivateVideo(
                user
              );

            } else {

              // FIXED: Wire up to actual private video call
              sessionStorage.setItem("privateVideoUserId", user.uid);
              sessionStorage.setItem("privateVideoUserName", user.displayName);
              sessionStorage.setItem("privateVideoUserPhoto", user.photoURL || "");
              window.location.href = "./private-video.html";

            }

          }
        );


        actions.appendChild(
          chatBtn
        );


        actions.appendChild(
          videoBtn
        );

      }


      item.appendChild(
        avatarWrap
      );


      item.appendChild(
        info
      );


      item.appendChild(
        actions
      );


      /* NAME / ROW CLICK */

      item.addEventListener(
        "click",
        () => {

          openMemberProfile(
            user
          );

        }
      );


      list.appendChild(
        item
      );

    }
  );


  updateMemberCount();

}


/* =========================================================
   COUNT
========================================================= */

function updateMemberCount() {

  if (
    $("onlineMemberCount")
  ) {

    $("onlineMemberCount").textContent =
      groupMembers.length;

  }


  if (
    $("infoMemberCount")
  ) {

    $("infoMemberCount").textContent =
      groupMembers.length;

  }

}


/* =========================================================
   SEARCH
========================================================= */

$("memberSearchInput")
  ?.addEventListener(
    "input",
    renderMembers
  );


/* =========================================================
   TABS
========================================================= */

$("usersTab")
  ?.addEventListener(
    "click",
    () => {

      friendsOnly =
        false;


      $("usersTab")
        .classList.add(
          "active"
        );


      $("friendsTab")
        .classList.remove(
          "active"
        );


      renderMembers();

    }
  );


$("friendsTab")
  ?.addEventListener(
    "click",
    () => {

      friendsOnly =
        true;


      $("friendsTab")
        .classList.add(
          "active"
        );


      $("usersTab")
        .classList.remove(
          "active"
        );


      renderMembers();

    }
  );


/* =========================================================
   PROFILE POPUP
========================================================= */

function openMemberProfile(
  user
) {

  selectedMember =
    user;


  $("popupAvatar").src =
    avatarUrl(
      user.displayName,
      user.photoURL || ""
    );


  $("popupName").textContent =
    user.displayName ||
    "ConnectNow User";


  $("popupUsername").textContent =
    "@" +
    String(
      user.displayName ||
      "user"
    )
      .replace(
        /\s+/g,
        ""
      )
      .toLowerCase();


  $("popupBio").textContent =
    user.bio ||
    "ConnectNow community member";


  const isMe =
    String(
      user.userId
    ) ===
    String(
      currentUser?.uid
    );


  $("popupAddFriendBtn")
    .style.display =
      isMe
        ? "none"
        : "";


  $("popupViewProfileBtn")
    .style.display =
      "";


  $("popupBlockBtn")
    .style.display =
      isMe
        ? "none"
        : "";


  $("popupReportBtn")
    .style.display =
      isMe
        ? "none"
        : "";


  if (
    !isMe &&
    (
      currentProfile.friendIds ||
      []
    ).includes(
      user.userId
    )
  ) {

    $("popupAddFriendBtn").textContent =
      "✓ Friend";

  } else {

    $("popupAddFriendBtn").textContent =
      "👥 Add Friend";

  }


  $("userProfilePopup")
    .classList.remove(
      "hidden"
    );


  $("userProfilePopup")
    .style.left =
      "50%";


  $("userProfilePopup")
    .style.top =
      "50%";


  $("userProfilePopup")
    .style.transform =
      "translate(-50%, -50%)";

}


/* =========================================================
   ADD FRIEND
========================================================= */

$("popupAddFriendBtn")
  ?.addEventListener(
    "click",
    async () => {

      if (
        !selectedMember ||
        !currentUser
      ) {

        return;

      }


      try {

        await updateDoc(
          doc(
            db,
            "users",
            currentUser.uid
          ),
          {
            friendIds:
              arrayUnion(
                selectedMember.userId
              )
          }
        );


        if (
          !currentProfile.friendIds.includes(
            selectedMember.userId
          )
        ) {

          currentProfile.friendIds.push(
            selectedMember.userId
          );

        }


        $("popupAddFriendBtn").textContent =
          "✓ Friend";


        toast(
          `${selectedMember.displayName} added as friend`
        );


        renderMembers();

      } catch (error) {

        console.error(
          error
        );


        toast(
          "Unable to add friend"
        );

      }

    }
  );


/* =========================================================
   PROFILE BUTTON
========================================================= */

$("popupViewProfileBtn")
  ?.addEventListener(
    "click",
    () => {

      if (!selectedMember)
        return;


      toast(
        `${selectedMember.displayName}'s profile`
      );

    }
  );


/* =========================================================
   BLOCK
========================================================= */

$("popupBlockBtn")
  ?.addEventListener(
    "click",
    () => {

      if (!selectedMember)
        return;


      socket?.emit(
        "blockUser",
        {
          userId:
            selectedMember.userId
        }
      );


      toast(
        `${selectedMember.displayName} blocked`
      );


      closeUserPopup();

    }
  );


/* =========================================================
   REPORT
========================================================= */

$("popupReportBtn")
  ?.addEventListener(
    "click",
    () => {

      if (!selectedMember)
        return;


      socket?.emit(
        "reportUser",
        {

          userId:
            selectedMember.userId,

          reason:
            "Reported from group profile"

        }
      );


      toast(
        "Report submitted"
      );


      closeUserPopup();

    }
  );


function closeUserPopup() {

  $("userProfilePopup")
    ?.classList.add(
      "hidden"
    );

}


/* =========================================================
   GROUP SEARCH
========================================================= */

$("groupSearchInput")
  ?.addEventListener(
    "input",
    () => {

      const term =
        $("groupSearchInput")
          .value
          .trim()
          .toLowerCase();


      document
        .querySelectorAll(
          ".group-item"
        )
        .forEach(
          (item) => {

            const name =
              (
                item.dataset.groupName ||
                ""
              )
                .toLowerCase();


            item.style.display =
              !term ||
              name.includes(term)
                ? ""
                : "none";

          }
        );

    }
  );


/* =========================================================
   CREATE GROUP
========================================================= */

$("createGroupBtn")
  ?.addEventListener(
    "click",
    () => {

      $("createGroupModal")
        .classList.remove(
          "hidden"
        );

    }
  );


$("closeCreateGroupBtn")
  ?.addEventListener(
    "click",
    closeCreateGroup
  );


$("cancelCreateGroupBtn")
  ?.addEventListener(
    "click",
    closeCreateGroup
  );


function closeCreateGroup() {

  $("createGroupModal")
    ?.classList.add(
      "hidden"
    );

}


$("saveCreateGroupBtn")
  ?.addEventListener(
    "click",
    createGroup
  );


async function createGroup() {

  if (!currentUser) {

    toast(
      "Please login first"
    );


    return;

  }


  const name =
    $("groupNameInput")
      .value
      .trim();


  const description =
    $("groupDescriptionInput")
      .value
      .trim();


  if (!name) {

    toast(
      "Enter group name"
    );


    return;

  }


  try {

    const ref =
      await addDoc(
        collection(
          db,
          "groups"
        ),
        {

          name,

          description:
            description ||
            "ConnectNow group",

          ownerId:
            currentUser.uid,

          memberIds: [
            currentUser.uid
          ],

          createdAt:
            serverTimestamp()

        }
      );


    addGroupToSidebar(
      ref.id,
      name,
      description
    );


    closeCreateGroup();


    $("groupNameInput").value =
      "";


    $("groupDescriptionInput").value =
      "";


    selectGroup(
      ref.id,
      name,
      description
    );


    toast(
      "Group created"
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      "Unable to create group"
    );

  }

}


/* =========================================================
   ADD GROUP
========================================================= */

function addGroupToSidebar(
  id,
  name,
  description
) {

  const list =
    $("groupList");


  if (!list)
    return;


  if (
    list.querySelector(
      `[data-group-id="${id}"]`
    )
  ) {

    return;

  }


  const item =
    document.createElement(
      "button"
    );


  item.className =
    "group-item";


  item.dataset.groupId =
    id;


  item.dataset.groupName =
    name;


  item.dataset.groupDescription =
    description;


  const avatar =
    document.createElement(
      "div"
    );


  avatar.className =
    "group-avatar";


  avatar.textContent =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map(
        x =>
          x[0]?.toUpperCase()
      )
      .join("");


  const content =
    document.createElement(
      "div"
    );


  content.className =
    "group-item-content";


  const title =
    document.createElement(
      "div"
    );


  title.className =
    "group-item-name";


  title.textContent =
    name;


  const sub =
    document.createElement(
      "div"
    );


  sub.className =
    "group-item-sub";


  sub.textContent =
    description ||
    "ConnectNow group";


  content.appendChild(
    title
  );


  content.appendChild(
    sub
  );


  item.appendChild(
    avatar
  );


  item.appendChild(
    content
  );


  list.appendChild(
    item
  );

}


/* =========================================================
   LOAD GROUPS
========================================================= */

function loadGroups() {

  try {

    const q =
      query(
        collection(
          db,
          "groups"
        ),
        orderBy(
          "createdAt",
          "desc"
        )
      );


    onSnapshot(
      q,
      (snapshot) => {

        snapshot.forEach(
          (docSnap) => {

            const data =
              docSnap.data();


            addGroupToSidebar(
              docSnap.id,
              data.name ||
                "Group",
              data.description ||
                "ConnectNow group"
            );

          }
        );

      },
      (error) => {

        console.warn(
          "Group loading error:",
          error
        );

      }
    );

  } catch (error) {

    console.warn(
      "Group query error:",
      error
    );

  }

}


/* =========================================================
   ROOM INFO
========================================================= */

$("roomInfoBtn")
  ?.addEventListener(
    "click",
    () => {

      $("infoRoomName").textContent =
        currentGroupName;


      $("infoRoomDescription").textContent =
        currentGroupDescription;


      $("infoMemberCount").textContent =
        groupMembers.length;


      $("roomInfoModal")
        .classList.remove(
          "hidden"
        );

    }
  );


$("closeRoomInfoBtn")
  ?.addEventListener(
    "click",
    () => {

      $("roomInfoModal")
        .classList.add(
          "hidden"
        );

    }
  );


/* =========================================================
   MOBILE USER DRAWER
========================================================= */

$("membersBtn")
  ?.addEventListener(
    "click",
    () => {

      const sidebar =
        $("membersSidebar");


      if (!sidebar)
        return;


      if (
        window.innerWidth <=
        950
      ) {

        sidebar.classList.toggle(
          "mobile-open"
        );

      }

    }
  );


/* =========================================================
   EMOJI
========================================================= */

const emojis = [

  "😀","😂","😍","🥰",
  "😎","😭","😡","😱",
  "👍","👎","❤️","🔥",
  "🎉","💯","👏","🙏",
  "😊","😉","😘","🤩",
  "🥳","😇","🤗","😴",
  "💜","💖","💙","💚",
  "✨","⭐","🌹","🎁"

];


function setupEmoji() {

  const grid =
    $("emojiGrid");


  if (!grid)
    return;


  emojis.forEach(
    (emoji) => {

      const btn =
        document.createElement(
          "button"
        );


      btn.className =
        "emoji-item";


      btn.textContent =
        emoji;


      btn.addEventListener(
        "click",
        () => {

          $("messageInput").value +=
            emoji;


          $("messageInput").focus();

        }
      );


      grid.appendChild(
        btn
      );

    }
  );


  $("emojiBtn")
    ?.addEventListener(
      "click",
      () => {

        $("emojiPanel")
          .classList.toggle(
            "hidden"
          );

      }
    );

}


/* =========================================================
   IMAGE / PAINT
========================================================= */

$("imageBtn")
  ?.addEventListener(
    "click",
    () => {

      toast(
        "Image upload ready"
      );

    }
  );


$("paintBtn")
  ?.addEventListener(
    "click",
    () => {

      toast(
        "Sticker panel ready"
      );

    }
  );


/* =========================================================
   ADMIN LOGIN
========================================================= */

function openAdminLogin() {

  $("adminLoginModal")
    ?.classList.remove(
      "hidden"
    );


  $("adminUsernameInput").value =
    "";


  $("adminPasswordInput").value =
    "";


  hideAdminLoginError();


  setTimeout(
    () => {

      $("adminUsernameInput")
        ?.focus();

    },
    100
  );

}


function closeAdminLogin() {

  $("adminLoginModal")
    ?.classList.add(
      "hidden"
    );

}


function showAdminLoginError(
  message
) {

  const el =
    $("adminLoginError");


  if (!el)
    return;


  el.textContent =
    message;


  el.classList.remove(
    "hidden"
  );

}


function hideAdminLoginError() {

  $("adminLoginError")
    ?.classList.add(
      "hidden"
    );

}


/* =========================================================
   ADMIN PUBLIC LIVE BUTTON
========================================================= */

$("liveBtn")
  ?.addEventListener(
    "click",
    () => {

      if (!adminToken) {

        openAdminLogin();

        return;

      }


      openLiveModal();

    }
  );


$("adminLoginBtn")
  ?.addEventListener(
    "click",
    adminLogin
  );


$("cancelAdminLoginBtn")
  ?.addEventListener(
    "click",
    closeAdminLogin
  );


$("closeAdminLoginBtn")
  ?.addEventListener(
    "click",
    closeAdminLogin
  );


$("adminPasswordInput")
  ?.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key ===
        "Enter"
      ) {

        adminLogin();

      }

    }
  );


async function adminLogin() {

  const username =
    $("adminUsernameInput")
      .value
      .trim();


  const password =
    $("adminPasswordInput")
      .value;


  hideAdminLoginError();


  if (!username) {

    showAdminLoginError(
      "Enter admin username."
    );


    return;

  }


  if (!password) {

    showAdminLoginError(
      "Enter admin password."
    );


    return;

  }


  const button =
    $("adminLoginBtn");


  button.disabled =
    true;


  button.textContent =
    "Checking...";


  try {

    const response =
      await fetch(
        `${SERVER_URL}/api/admin/login`,
        {

          method:
            "POST",

          headers:
            {
              "Content-Type":
                "application/json"
            },

          body:
            JSON.stringify(
              {
                username,
                password
              }
            )

        }
      );


    const result =
      await response.json();


    if (
      !response.ok ||
      !result.success
    ) {

      showAdminLoginError(
        result.message ||
        "Invalid admin credentials."
      );


      return;

    }


    adminToken =
      result.token;


    sessionStorage.setItem(
      "connectnowAdminToken",
      adminToken
    );


    closeAdminLogin();


    toast(
      "Admin verified successfully"
    );


    openLiveModal();

  } catch (error) {

    console.error(
      "Admin login error:",
      error
    );


    showAdminLoginError(
      "Admin server is not available."
    );

  } finally {

    button.disabled =
      false;


    button.textContent =
      "Login & Continue";

  }

}


/* =========================================================
   ADMIN PUBLIC LIVE
========================================================= */

function openLiveModal() {

  if (!adminToken) {

    openAdminLogin();

    return;

  }


  $("liveStreamModal")
    .classList.remove(
      "hidden"
    );


  $("liveHostName").textContent =
    currentProfile.displayName;

}


$("startLiveBtn")
  ?.addEventListener(
    "click",
    startLive
  );


async function startLive() {

  if (!adminToken) {

    openAdminLogin();

    return;

  }


  if (
    !socket ||
    !socket.connected
  ) {

    toast(
      "Chat server not connected"
    );


    return;

  }


  try {

    localLiveStream =
      await navigator.mediaDevices.getUserMedia(
        {
          video:
            true,

          audio:
            true
        }
      );


    $("localLiveVideo").srcObject =
      localLiveStream;


    isLiveHost =
      true;


    $("liveHostName").textContent =
      currentProfile.displayName;


    socket.emit(
      "startGroupLive",
      {

        roomId:
          currentGroupId,

        hostName:
          currentProfile.displayName,

        adminToken

      }
    );


    toast(
      "Live stream started"
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      "Camera and microphone permission required"
    );

  }

}


/* =========================================================
   ADMIN LIVE SOCKET
========================================================= */

function setupLiveSocketEvents() {

  if (!socket)
    return;


  socket.on(
    "groupLiveStarted",
    (data) => {

      if (
        data.roomId !==
        currentGroupId
      ) {

        return;

      }


      $("liveHostName").textContent =
        data.hostName ||
        "Live Host";


      $("liveStreamModal")
        .classList.remove(
          "hidden"
        );


      if (
        data.hostSocketId !==
        socket.id
      ) {

        socket.emit(
          "groupLiveViewer",
          {
            roomId:
              currentGroupId
          }
        );

      }

    }
  );


  socket.on(
    "groupLiveViewerJoined",
    async (data) => {

      if (!isLiveHost)
        return;


      await createHostPeer(
        data.viewerSocketId
      );

    }
  );


  socket.on(
    "groupLiveOffer",
    async (data) => {

      if (isLiveHost)
        return;


      await handleViewerOffer(
        data
      );

    }
  );


  socket.on(
    "groupLiveAnswer",
    async (data) => {

      const peer =
        livePeers.get(
          data.fromSocketId
        );


      if (
        peer &&
        data.answer
      ) {

        await peer.setRemoteDescription(
          data.answer
        );

      }

    }
  );


  socket.on(
    "groupLiveIce",
    async (data) => {

      const peer =
        livePeers.get(
          data.fromSocketId
        );


      if (
        peer &&
        data.candidate
      ) {

        try {

          await peer.addIceCandidate(
            data.candidate
          );

        } catch (error) {

          console.warn(
            error
          );

        }

      }

    }
  );


  socket.on(
    "groupLiveStopped",
    (data) => {

      if (
        data.roomId !==
        currentGroupId
      ) {

        return;

      }


      stopLocalLive(
        false
      );


      toast(
        "Admin live stream ended"
      );

    }
  );


  socket.on(
    "groupLiveHostLeft",
    () => {

      stopLocalLive(
        false
      );


      toast(
        "Admin live host disconnected"
      );

    }
  );

}


async function createHostPeer(
  viewerSocketId
) {

  if (
    !localLiveStream ||
    !socket
  ) {

    return;

  }


  const peer =
    new RTCPeerConnection(
      {

        iceServers:
          [
            {
              urls:
                "stun:stun.l.google.com:19302"
            },

            {
              urls:
                "stun:stun1.l.google.com:19302"
            }
          ]

      }
    );


  livePeers.set(
    viewerSocketId,
    peer
  );


  localLiveStream
    .getTracks()
    .forEach(
      (track) => {

        peer.addTrack(
          track,
          localLiveStream
        );

      }
    );


  peer.onicecandidate =
    (event) => {

      if (
        event.candidate
      ) {

        socket.emit(
          "groupLiveIce",
          {

            roomId:
              currentGroupId,

            targetSocketId:
              viewerSocketId,

            candidate:
              event.candidate

          }
        );

      }

    };


  const offer =
    await peer.createOffer();


  await peer.setLocalDescription(
    offer
  );


  socket.emit(
    "groupLiveOffer",
    {

      roomId:
        currentGroupId,

      targetSocketId:
        viewerSocketId,

      offer

    }
  );

}


async function handleViewerOffer(
  data
) {

  const peer =
    new RTCPeerConnection(
      {

        iceServers:
          [
            {
              urls:
                "stun:stun.l.google.com:19302"
            },

            {
              urls:
                "stun:stun1.l.google.com:19302"
            }
          ]

      }
    );


  livePeers.set(
    data.fromSocketId,
    peer
  );


  const remoteStream =
    new MediaStream();


  peer.ontrack =
    (event) => {

      event.streams[0]
        .getTracks()
        .forEach(
          (track) => {

            remoteStream.addTrack(
              track
            );

          }
        );


      showRemoteLiveVideo(
        data.fromSocketId,
        remoteStream
      );

    };


  peer.onicecandidate =
    (event) => {

      if (
        event.candidate
      ) {

        socket.emit(
          "groupLiveIce",
          {

            roomId:
              currentGroupId,

            targetSocketId:
              data.fromSocketId,

            candidate:
              event.candidate

          }
        );

      }

    };


  await peer.setRemoteDescription(
    data.offer
  );


  const answer =
    await peer.createAnswer();


  await peer.setLocalDescription(
    answer
  );


  socket.emit(
    "groupLiveAnswer",
    {

      roomId:
        currentGroupId,

      targetSocketId:
        data.fromSocketId,

      answer

    }
  );

}


function showRemoteLiveVideo(
  socketId,
  stream
) {

  if (
    remoteStreams.has(
      socketId
    )
  ) {

    return;

  }


  remoteStreams.set(
    socketId,
    stream
  );


  const video =
    document.createElement(
      "video"
    );


  video.className =
    "remote-live-video";


  video.autoplay =
    true;


  video.playsInline =
    true;


  video.srcObject =
    stream;


  $("liveRemoteVideos")
    .appendChild(
      video
    );

}


$("stopLiveBtn")
  ?.addEventListener(
    "click",
    () => {

      if (
        socket &&
        isLiveHost
      ) {

        socket.emit(
          "stopGroupLive",
          {

            roomId:
              currentGroupId,

            adminToken

          }
        );

      }


      stopLocalLive(
        true
      );

    }
  );


function stopLocalLive(
  notifyServer = true
) {

  if (
    notifyServer &&
    isLiveHost &&
    socket
  ) {

    socket.emit(
      "stopGroupLive",
      {

        roomId:
          currentGroupId,

        adminToken

      }
    );

  }


  if (localLiveStream) {

    localLiveStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );


    localLiveStream =
      null;

  }


  livePeers.forEach(
    (peer) => {

      try {

        peer.close();

      } catch {}

    }
  );


  livePeers.clear();


  remoteStreams.clear();


  if (
    $("localLiveVideo")
  ) {

    $("localLiveVideo").srcObject =
      null;

  }


  if (
    $("liveRemoteVideos")
  ) {

    $("liveRemoteVideos").innerHTML =
      "";

  }


  isLiveHost =
    false;


  $("liveStreamModal")
    ?.classList.add(
      "hidden"
    );

}


$("closeLiveBtn")
  ?.addEventListener(
    "click",
    () => {

      if (isLiveHost) {

        toast(
          "Stop the live before closing"
        );


        return;

      }


      $("liveStreamModal")
        .classList.add(
          "hidden"
        );

    }
  );


$("closeLiveOnlyBtn")
  ?.addEventListener(
    "click",
    () => {

      if (isLiveHost) {

        toast(
          "Stop the live before closing"
        );


        return;

      }


      $("liveStreamModal")
        .classList.add(
          "hidden"
        );

    }
  );


/* =========================================================
   PRIVATE VIDEO SOCKET EVENTS
========================================================= */

function setupPrivateVideoSocketEvents() {

  if (!socket)
    return;


  /* USER STARTED PRIVATE LIVE */

  socket.on(
    "privateVideoStarted",
    (data) => {

      if (
        data.roomId !==
        currentGroupId
      ) {

        return;

      }


      const target =
        groupMembers.find(
          (user) =>
            String(
              user.socketId
            ) ===
            String(
              data.hostSocketId
            )
        );


      if (target) {

        target.privateLive =
          true;

      }


      renderMembers();

    }
  );


  /* USER STOPPED PRIVATE LIVE */

  socket.on(
    "privateVideoStopped",
    (data) => {

      const target =
        groupMembers.find(
          (user) =>
            String(
              user.socketId
            ) ===
            String(
              data.hostSocketId
            )
        );


      if (target) {

        target.privateLive =
          false;

      }


      renderMembers();


      if (
        privateRole ===
          "viewer" &&
        privateRemoteSocketId ===
          data.hostSocketId
      ) {

        endPrivateVideoUI();


        toast(
          "Private live ended"
        );

      }

    }
  );


  /* HOST GETS VIEWER */

  socket.on(
    "privateVideoViewerJoined",
    async (data) => {

      if (
        !privateLiveActive
      ) {

        return;

      }


      await createPrivateHostPeer(
        data.viewerSocketId
      );

    }
  );


  /* VIEWER GETS OFFER */

  socket.on(
    "privateVideoOffer",
    async (data) => {

      if (
        privateRole !==
          "viewer"
      ) {

        return;

      }


      await handlePrivateViewerOffer(
        data
      );

    }
  );


  /* HOST GETS ANSWER */

  socket.on(
    "privateVideoAnswer",
    async (data) => {

      if (
        !privatePeer ||
        !data.answer
      ) {

        return;

      }


      await privatePeer.setRemoteDescription(
        data.answer
      );

    }
  );


  /* ICE */

  socket.on(
    "privateVideoIce",
    async (data) => {

      if (
        !privatePeer ||
        !data.candidate
      ) {

        return;

      }


      try {

        await privatePeer.addIceCandidate(
          data.candidate
        );

      } catch (error) {

        console.warn(
          "Private ICE error:",
          error
        );

      }

    }
  );


  /* VIEWER LEFT */

  socket.on(
    "privateVideoViewerLeft",
    () => {

      if (
        privateRole ===
          "host"
      ) {

        $("privateVideoStatus").textContent =
          "Waiting for a viewer";

        $("privateRemoteVideo").srcObject =
          null;

      }

    }
  );


  /* SOCKET CLOSED BY HOST */

  socket.on(
    "privateVideoEndedForViewer",
    () => {

      if (
        privateRole ===
          "viewer"
      ) {

        endPrivateVideoUI();


        toast(
          "Private video ended"
        );

      }

    }
  );

}


/* =========================================================
   PRIVATE VIDEO START
========================================================= */

async function startPrivateLive() {

  if (
    privateLiveActive
  ) {

    return;

  }


  if (
    !socket ||
    !socket.connected
  ) {

    toast(
      "Chat server not connected"
    );


    return;

  }


  try {

    privateLocalStream =
      await navigator.mediaDevices.getUserMedia(
        {

          video:
            true,

          audio:
            true

        }
      );


    $("privateLocalVideo").srcObject =
      privateLocalStream;


    privateRole =
      "host";


    privateLiveActive =
      true;


    $("privateVideoTitle").textContent =
      "My Private Video";


    $("privateVideoStatus").textContent =
      "Live • waiting for a viewer";


    $("privateVideoModal")
      .classList.remove(
        "hidden"
      );


    socket.emit(
      "startPrivateVideo",
      {

        roomId:
          currentGroupId

      }
    );


    renderMembers();


    toast(
      "Your private video is live"
    );

  } catch (error) {

    console.error(
      "Private video start:",
      error
    );


    toast(
      "Camera and microphone permission required"
    );

  }

}


/* =========================================================
   REQUEST PRIVATE VIDEO
========================================================= */

function requestPrivateVideo(
  user
) {

  if (!user)
    return;


  if (
    !user.socketId
  ) {

    toast(
      "User connection unavailable"
    );


    return;

  }


  privateRole =
    "viewer";


  privateRemoteSocketId =
    user.socketId;


  $("privateVideoTitle").textContent =
    user.displayName;


  $("privateVideoStatus").textContent =
    "Connecting to private video...";


  $("privateVideoModal")
    .classList.remove(
      "hidden"
    );


  socket.emit(
    "requestPrivateVideo",
    {

      roomId:
        currentGroupId,

      targetSocketId:
        user.socketId

    }
  );

}


/* =========================================================
   PRIVATE HOST PEER
========================================================= */

async function createPrivateHostPeer(
  viewerSocketId
) {

  if (
    !privateLocalStream ||
    !socket
  ) {

    return;

  }


  privateRemoteSocketId =
    viewerSocketId;


  privatePeer =
    new RTCPeerConnection(
      {

        iceServers:
          [
            {
              urls:
                "stun:stun.l.google.com:19302"
            },

            {
              urls:
                "stun:stun1.l.google.com:19302"
            }
          ]

      }
    );


  privateLocalStream
    .getTracks()
    .forEach(
      (track) => {

        privatePeer.addTrack(
          track,
          privateLocalStream
        );

      }
    );


  privatePeer.ontrack =
    (event) => {

      if (
        event.streams &&
        event.streams[0]
      ) {

        $("privateRemoteVideo").srcObject =
          event.streams[0];

      }

    };


  privatePeer.onicecandidate =
    (event) => {

      if (
        event.candidate
      ) {

        socket.emit(
          "privateVideoIce",
          {

            targetSocketId:
              viewerSocketId,

            candidate:
              event.candidate

          }
        );

      }

    };


  $("privateVideoStatus").textContent =
    "Private video connected";


  const offer =
    await privatePeer.createOffer();


  await privatePeer.setLocalDescription(
    offer
  );


  socket.emit(
    "privateVideoOffer",
    {

      targetSocketId:
        viewerSocketId,

      offer

    }
  );

}


/* =========================================================
   PRIVATE VIEWER OFFER
========================================================= */

async function handlePrivateViewerOffer(
  data
) {

  privateRemoteSocketId =
    data.fromSocketId;


  privatePeer =
    new RTCPeerConnection(
      {

        iceServers:
          [
            {
              urls:
                "stun:stun.l.google.com:19302"
            },

            {
              urls:
                "stun:stun1.l.google.com:19302"
            }
          ]

      }
    );


  privateRemoteStream =
    new MediaStream();


  privatePeer.ontrack =
    (event) => {

      if (
        event.streams &&
        event.streams[0]
      ) {

        $("privateRemoteVideo").srcObject =
          event.streams[0];

      }

    };


  privatePeer.onicecandidate =
    (event) => {

      if (
        event.candidate
      ) {

        socket.emit(
          "privateVideoIce",
          {

            targetSocketId:
              data.fromSocketId,

            candidate:
              event.candidate

          }
        );

      }

    };


  await privatePeer.setRemoteDescription(
    data.offer
  );


  const answer =
    await privatePeer.createAnswer();


  await privatePeer.setLocalDescription(
    answer
  );


  socket.emit(
    "privateVideoAnswer",
    {

      targetSocketId:
        data.fromSocketId,

      answer

    }
  );


  $("privateVideoStatus").textContent =
    "Private video connected";

}


/* =========================================================
   STOP OWN PRIVATE LIVE
========================================================= */

function stopPrivateLive() {

  if (
    !privateLiveActive
  ) {

    return;

  }


  if (socket) {

    socket.emit(
      "stopPrivateVideo",
      {

        roomId:
          currentGroupId

      }
    );

  }


  closePrivatePeer();


  if (
    privateLocalStream
  ) {

    privateLocalStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );


    privateLocalStream =
      null;

  }


  privateLiveActive =
    false;


  privateRole =
    "";


  privateRemoteSocketId =
    null;


  renderMembers();


  endPrivateVideoUI();


  toast(
    "Private video stopped"
  );

}


/* =========================================================
   CLOSE PRIVATE VIDEO
========================================================= */

function closePrivatePeer() {

  if (privatePeer) {

    try {

      privatePeer.close();

    } catch {}

    privatePeer =
      null;

  }

}


function endPrivateVideoUI() {

  closePrivatePeer();


  if (
    $("privateRemoteVideo")
  ) {

    $("privateRemoteVideo").srcObject =
      null;

  }


  if (
    $("privateLocalVideo")
  ) {

    $("privateLocalVideo").srcObject =
      null;

  }


  $("privateVideoModal")
    ?.classList.add(
      "hidden"
    );


  privateRemoteSocketId =
    null;


  privateRole =
    "";

}


/* =========================================================
   END / CLOSE PRIVATE
========================================================= */

$("endPrivateVideoBtn")
  ?.addEventListener(
    "click",
    () => {

      if (
        privateRole ===
        "host"
      ) {

        stopPrivateLive();

        return;

      }


      if (
        privateRole ===
        "viewer"
      ) {

        if (socket) {

          socket.emit(
            "endPrivateVideo",
            {

              targetSocketId:
                privateRemoteSocketId

            }
          );

        }


        endPrivateVideoUI();

      }

    }
  );


$("closePrivateVideoBtn")
  ?.addEventListener(
    "click",
    () => {

      if (
        privateRole ===
        "host"
      ) {

        stopPrivateLive();

        return;

      }


      if (
        privateRole ===
        "viewer"
      ) {

        socket?.emit(
          "endPrivateVideo",
          {

            targetSocketId:
              privateRemoteSocketId

          }
        );

      }


      endPrivateVideoUI();

    }
  );


$("stopPrivateVideoBtn")
  ?.addEventListener(
    "click",
    () => {

      if (
        privateRole ===
        "host"
      ) {

        stopPrivateLive();

      } else {

        endPrivateVideoUI();

      }

    }
  );


$("startPrivateVideoBtn")
  ?.addEventListener(
    "click",
    startPrivateLive
  );


/* =========================================================
   ACCOUNT MENU
========================================================= */

$("profileHeaderBtn")
  ?.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();


      $("profileMenu")
        ?.classList.toggle(
          "hidden"
        );

    }
  );


$("leftProfileCard")
  ?.addEventListener(
    "click",
    () => {

      $("profileMenu")
        ?.classList.toggle(
          "hidden"
        );

    }
  );


$("menuProfile")
  ?.addEventListener(
    "click",
    () => {

      $("profileMenu")
        .classList.add(
          "hidden"
        );


      toast(
        currentProfile.displayName
      );

    }
  );


$("menuPreferences")
  ?.addEventListener(
    "click",
    () => {

      toast(
        "Preferences"
      );

    }
  );


$("menuLightMode")
  ?.addEventListener(
    "click",
    () => {

      toast(
        "Light mode"
      );

    }
  );


$("menuSounds")
  ?.addEventListener(
    "click",
    () => {

      toast(
        "Sounds on"
      );

    }
  );


$("menuForum")
  ?.addEventListener(
    "click",
    () => {

      toast(
        "Forum"
      );

    }
  );


$("menuGoogleLogin")
  ?.addEventListener(
    "click",
    googleLogin
  );


$("menuLogout")
  ?.addEventListener(
    "click",
    logout
  );


$("logoutBtn")
  ?.addEventListener(
    "click",
    logout
  );


/* =========================================================
   GOOGLE LOGIN
========================================================= */

async function googleLogin() {

  try {

    const provider =
      new GoogleAuthProvider();


    await signInWithPopup(
      auth,
      provider
    );


    toast(
      "Google login successful"
    );

  } catch (error) {

    console.error(
      error
    );


    toast(
      "Google login failed"
    );

  }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

  try {

    if (privateLiveActive) {

      stopPrivateLive();

    }


    if (socket) {

      socket.emit(
        "leaveGroup"
      );


      socket.disconnect();

    }


    adminToken =
      "";


    sessionStorage.removeItem(
      "connectnowAdminToken"
    );


    await signOut(
      auth
    );


    window.location.href =
      "./index.html";

  } catch (error) {

    console.error(
      error
    );


    toast(
      "Logout failed"
    );

  }

}


/* =========================================================
   HOME
========================================================= */

$("homeBtn")
  ?.addEventListener(
    "click",
    () => {

      window.location.href =
        "./index.html";

    }
  );


/* =========================================================
   NOTIFICATION
========================================================= */

$("notificationBtn")
  ?.addEventListener(
    "click",
    () => {

      toast(
        "No new notifications"
      );

    }
  );


/* =========================================================
   PROFILE MENU OUTSIDE
========================================================= */

document.addEventListener(
  "click",
  (event) => {

    const menu =
      $("profileMenu");


    if (
      menu &&
      !menu.classList.contains(
        "hidden"
      ) &&
      !menu.contains(
        event.target
      ) &&
      event.target !==
        $("profileHeaderBtn")
    ) {

      menu.classList.add(
        "hidden"
      );

    }


    const popup =
      $("userProfilePopup");


    if (
      popup &&
      !popup.classList.contains(
        "hidden"
      ) &&
      !popup.contains(
        event.target
      )
    ) {

      closeUserPopup();

    }

  }
);


/* =========================================================
   ESC
========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !==
      "Escape"
    ) {

      return;

    }


    $("createGroupModal")
      ?.classList.add(
        "hidden"
      );


    $("roomInfoModal")
      ?.classList.add(
        "hidden"
      );


    $("adminLoginModal")
      ?.classList.add(
        "hidden"
      );


    $("userProfilePopup")
      ?.classList.add(
        "hidden"
      );


    $("emojiPanel")
      ?.classList.add(
        "hidden"
      );


    if (
      window.innerWidth <=
      950
    ) {

      $("membersSidebar")
        ?.classList.remove(
          "mobile-open"
        );

    }

  }
);


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    currentUser =
      user;


    if (user) {

      await loadProfile();

    } else {

      currentProfile = {

        displayName:
          "ConnectNow User",

        photoURL:
          "",

        bio:
          "ConnectNow user",

        friendIds:
          []

      };


      updateProfileUI();

    }


    if (!socket) {

      connectSocket();

    } else {

      registerSocket();

      joinCurrentGroup();

    }

  }
);


/* =========================================================
   STARTUP
========================================================= */

setupGroupList();

setupComposer();

setupEmoji();

loadGroups();

selectGroup(
  COMMUNITY_GROUP_ID,
  "ConnectNow Community",
  "Public ConnectNow community"
);