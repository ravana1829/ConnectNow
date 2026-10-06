/* =========================================================
   CONNECTNOW RANDOM VIDEO CALL PAGE
   VIDEO + CHAT UI
   ========================================================= */

import {
  protectPage,
  onAuthReady,
  currentProfile,
  handleLogout,
  decrementFreeRandomVideoChat,
  setAvatar
} from "./auth-helper.js";

import RandomVideoMatcher from "./random-video-matcher.js";


/* =========================================================
   NAVIGATION
========================================================= */

const mobileMenuBtn =
  document.getElementById(
    "mobileMenuBtn"
  );

const mobileNav =
  document.getElementById(
    "mobileNav"
  );

const rewardsMenuBtn =
  document.getElementById(
    "rewardsMenuBtn"
  );

const rewardsMenu =
  document.getElementById(
    "rewardsMenu"
  );

const profileMenuBtn =
  document.getElementById(
    "profileMenuBtn"
  );

const profileMenu =
  document.getElementById(
    "profileMenu"
  );

const dropdownLogoutBtn =
  document.getElementById(
    "dropdownLogoutBtn"
  );

const mobileLogoutBtn =
  document.getElementById(
    "mobileLogoutBtn"
  );

const navUserName =
  document.getElementById(
    "navUserName"
  );

const navUserAvatar =
  document.getElementById(
    "navUserAvatar"
  );

const dropdownUserName =
  document.getElementById(
    "dropdownUserName"
  );

const dropdownUserEmail =
  document.getElementById(
    "dropdownUserEmail"
  );

const dropdownUserAvatar =
  document.getElementById(
    "dropdownUserAvatar"
  );


/* =========================================================
   VIDEO DOM
========================================================= */

const videoFeed =
  document.getElementById(
    "videoFeed"
  );

const localVideoBox =
  document.getElementById(
    "localVideo"
  );

const videoWindow =
  document.getElementById(
    "videoWindow"
  );

const callerName =
  document.getElementById(
    "callerName"
  );

const callHeader =
  document.getElementById(
    "callHeader"
  );

const callTimer =
  document.getElementById(
    "callTimer"
  );

const muteMicBtn =
  document.getElementById(
    "muteMicBtn"
  );

const endCallBtn =
  document.getElementById(
    "endCallBtn"
  );

const toggleCameraBtn =
  document.getElementById(
    "toggleCameraBtn"
  );

const nextBtn =
  document.getElementById(
    "nextBtn"
  );

const reportBtn =
  document.getElementById(
    "reportBtn"
  );

const blockBtn =
  document.getElementById(
    "blockBtn"
  );

const sidebarContent =
  document.getElementById(
    "sidebarContent"
  );

const noFreeWarning =
  document.getElementById(
    "noFreeWarning"
  );

const timeLimitWarning =
  document.getElementById(
    "timeLimitWarning"
  );

const freeVideoBadge =
  document.getElementById(
    "freeVideoBadge"
  );


/* =========================================================
   VIDEO CHAT DOM
========================================================= */

const videoChatMessages =
  document.getElementById(
    "videoChatMessages"
  );

const videoChatInput =
  document.getElementById(
    "videoChatInput"
  );

const videoChatSendBtn =
  document.getElementById(
    "videoChatSendBtn"
  );


/* =========================================================
   STATE
========================================================= */

let remoteVideo = null;
let localVideo = null;

let searchRunning = false;
let callActive = false;
let callConnected = false;

let isMuted = false;
let isCameraOn = true;

let timerInterval = null;
let callStartTime = null;

let freeAttemptConsumed = false;

let authenticated = false;
let nextPending = false;


/* =========================================================
   CONSTANTS
========================================================= */

const FREE_CALL_DURATION =
  120;


/* =========================================================
   CREATE VIDEO ELEMENT
========================================================= */

function makeVideoElement(
  id,
  muted
) {

  const video =
    document.createElement(
      "video"
    );

  video.id = id;

  video.autoplay =
    true;

  video.playsInline =
    true;

  video.muted =
    Boolean(muted);

  video.setAttribute(
    "playsinline",
    ""
  );

  video.style.width =
    "100%";

  video.style.height =
    "100%";

  video.style.objectFit =
    "cover";

  video.style.background =
    "#000";

  video.style.borderRadius =
    "inherit";

  return video;
}


/* =========================================================
   PREPARE VIDEO UI
========================================================= */

function prepareVideoUI() {

  if (
    videoFeed &&
    !remoteVideo
  ) {

    videoFeed.innerHTML =
      "";

    remoteVideo =
      makeVideoElement(
        "remoteVideo",
        false
      );

    videoFeed.appendChild(
      remoteVideo
    );

  }


  if (
    localVideoBox &&
    !localVideo
  ) {

    localVideoBox.innerHTML =
      "";

    localVideo =
      makeVideoElement(
        "localVideoElement",
        true
      );

    localVideoBox.appendChild(
      localVideo
    );

  }

}


/* =========================================================
   USER UI
========================================================= */

function updateUserUI() {

  const name =
    currentProfile?.displayName ||
    "ConnectNow User";

  const email =
    currentProfile?.email ||
    "ConnectNow account";

  if (navUserName) {

    navUserName.textContent =
      name;

  }

  if (
    dropdownUserName
  ) {

    dropdownUserName.textContent =
      name;

  }

  if (
    dropdownUserEmail
  ) {

    dropdownUserEmail.textContent =
      email;

  }

  setAvatar(
    navUserAvatar,
    currentProfile?.photoURL ||
      "",
    name
  );

  setAvatar(
    dropdownUserAvatar,
    currentProfile?.photoURL ||
      "",
    name
  );

}


/* =========================================================
   FREE COUNT
========================================================= */

function getFreeCount() {

  return Number(
    currentProfile
      ?.randomVideoChatFreeCount ??
      0
  );

}


/* =========================================================
   FREE UI
========================================================= */

function updateFreeUI() {

  const count =
    getFreeCount();

  updateFreeBadge();

  if (noFreeWarning) {

    noFreeWarning.style.display =
      count <= 0
        ? "block"
        : "none";

  }

  if (timeLimitWarning) {

    timeLimitWarning.style.display =
      count > 0
        ? "block"
        : "none";

  }

}


/* =========================================================
   SIDEBAR SUPPORT
========================================================= */

function setSidebar(
  message
) {

  if (sidebarContent) {

    sidebarContent.innerHTML =
      `<p>${escapeHtml(message)}</p>`;

  }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value || ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  status,
  info
) {

  if (callerName) {

    callerName.textContent =
      status ||
      "Connecting...";

  }

  if (callHeader) {

    callHeader.style.display =
      "block";

  }

  if (
    sidebarContent &&
    info
  ) {

    setSidebar(
      info
    );

  }

}


/* =========================================================
   LOADING TEXT
========================================================= */

function showLoadingText() {

  prepareVideoUI();

  if (remoteVideo) {

    remoteVideo.srcObject =
      null;

  }

  if (
    videoFeed &&
    !remoteVideo?.srcObject
  ) {

    if (
      !videoFeed.querySelector(
        ".video-loading-message"
      )
    ) {

      const message =
        document.createElement(
          "span"
        );

      message.className =
        "video-loading-message";

      message.textContent =
        "Loading video feed...";

      message.style.position =
        "absolute";

      message.style.zIndex =
        "2";

      videoFeed.style.position =
        "relative";

      videoFeed.appendChild(
        message
      );

    }

  }

}


/* =========================================================
   REMOVE LOADING
========================================================= */

function removeLoadingText() {

  videoFeed
    ?.querySelector(
      ".video-loading-message"
    )
    ?.remove();

}


/* =========================================================
   LOCAL STREAM
========================================================= */

function attachLocalStream() {

  prepareVideoUI();

  const stream =
    RandomVideoMatcher.getLocalStream();

  if (
    !localVideo ||
    !stream
  ) {

    return;

  }

  localVideo.srcObject =
    stream;

  localVideo
    .play?.()
    .catch(
      () => {}
    );

  if (localVideoBox) {

    localVideoBox.style.overflow =
      "hidden";

  }

}


/* =========================================================
   REMOTE STREAM
========================================================= */

function attachRemoteStream(
  stream
) {

  prepareVideoUI();

  removeLoadingText();

  if (
    !remoteVideo ||
    !stream
  ) {

    return;

  }

  remoteVideo.srcObject =
    stream;

  remoteVideo
    .play?.()
    .catch(
      () => {}
    );

}


/* =========================================================
   FREE BADGE
========================================================= */

function updateFreeBadge() {

  if (freeVideoBadge) {

    freeVideoBadge.textContent =
      `Free: ${getFreeCount()}/10`;

  }

}


/* =========================================================
   ADD CHAT MESSAGE
========================================================= */

function addChatMessage(
  message,
  type = "theirs"
) {

  if (
    !videoChatMessages ||
    !message
  ) {

    return;

  }

  const item =
    document.createElement(
      "div"
    );

  item.className =
    `video-chat-message ${
      type === "mine"
        ? "mine"
        : "theirs"
    }`;

  item.textContent =
    `${
      type === "mine"
        ? "You"
        : "Stranger"
    }: ${message}`;

  videoChatMessages.appendChild(
    item
  );

  videoChatMessages.scrollTop =
    videoChatMessages.scrollHeight;

}


/* =========================================================
   CLEAR CHAT
========================================================= */

function clearChat() {

  if (videoChatMessages) {

    videoChatMessages.innerHTML =
      "";

  }

}


/* =========================================================
   ENABLE / DISABLE CHAT
========================================================= */

function setChatEnabled(
  enabled
) {

  if (videoChatInput) {

    videoChatInput.disabled =
      !enabled;

  }

  if (
    videoChatSendBtn
  ) {

    videoChatSendBtn.disabled =
      !enabled;

  }

}


/* =========================================================
   SEND CHAT
========================================================= */

async function sendChatMessage() {

  if (
    !callConnected ||
    !videoChatInput
  ) {

    return;

  }

  const message =
    videoChatInput.value.trim();

  if (!message) {

    return;

  }

  try {

    const sent =
      await RandomVideoMatcher.sendChatMessage(
        message
      );

    if (!sent) {

      return;

    }

    addChatMessage(
      message,
      "mine"
    );

    videoChatInput.value =
      "";

    videoChatInput.focus();

  } catch (error) {

    console.error(
      "Video chat send error",
      error
    );

  }

}


/* =========================================================
   TIMER
========================================================= */

function startTimer() {

  stopTimer();

  callStartTime =
    Date.now();

  updateTimer();

  timerInterval =
    setInterval(
      updateTimer,
      1000
    );

}


/* =========================================================
   UPDATE TIMER
========================================================= */

function updateTimer() {

  if (
    !callActive ||
    !callStartTime
  ) {

    return;

  }

  const elapsed =
    Math.floor(
      (
        Date.now() -
        callStartTime
      ) / 1000
    );

  const remaining =
    Math.max(
      0,
      FREE_CALL_DURATION -
        elapsed
    );

  const minutes =
    Math.floor(
      remaining / 60
    );

  const seconds =
    remaining % 60;

  if (callTimer) {

    callTimer.textContent =
      `${minutes}:${String(
        seconds
      ).padStart(2, "0")}`;

  }

  if (
    remaining <= 0
  ) {

    endCallDueToTimeLimit();

  }

}


/* =========================================================
   STOP TIMER
========================================================= */

function stopTimer() {

  if (timerInterval) {

    clearInterval(
      timerInterval
    );

  }

  timerInterval =
    null;

  callStartTime =
    null;

  if (callTimer) {

    callTimer.textContent =
      "2:00";

  }

}


/* =========================================================
   BUTTON STATE
========================================================= */

function updateButtons() {

  const matched =
    Boolean(
      RandomVideoMatcher.getRoomId()
    );

  if (nextBtn) {

    nextBtn.disabled =
      !matched ||
      nextPending;

  }

  if (endCallBtn) {

    endCallBtn.disabled =
      !matched &&
      !callActive &&
      !searchRunning;

  }

  if (muteMicBtn) {

    muteMicBtn.disabled =
      !matched;

  }

  if (toggleCameraBtn) {

    toggleCameraBtn.disabled =
      !matched;

  }

  if (reportBtn) {

    reportBtn.disabled =
      !matched;

  }

  if (blockBtn) {

    blockBtn.disabled =
      !matched;

  }

}


/* =========================================================
   CONSUME FREE ATTEMPT
========================================================= */

async function consumeFreeAttempt() {

  if (
    freeAttemptConsumed
  ) {

    return true;

  }

  if (
    getFreeCount() <= 0
  ) {

    return false;

  }

  const ok =
    await decrementFreeRandomVideoChat();

  if (!ok) {

    return false;

  }

  freeAttemptConsumed =
    true;

  updateFreeUI();

  return true;

}


/* =========================================================
   START SEARCH
========================================================= */

async function startSearch(
  message =
    "Finding a random video person..."
) {

  if (
    !authenticated ||
    searchRunning
  ) {

    return;

  }

  if (
    getFreeCount() <= 0
  ) {

    updateFreeUI();

    setStatus(
      "No free calls",
      "Use diamonds from Wallet to continue."
    );

    return;

  }

  searchRunning =
    true;

  callActive =
    false;

  clearChat();

  setChatEnabled(
    false
  );

  callConnected =
    false;

  freeAttemptConsumed =
    false;

  nextPending =
    false;

  stopTimer();

  prepareVideoUI();

  showLoadingText();

  if (callerName) {

    callerName.textContent =
      "Finding...";

  }

  if (callTimer) {

    callTimer.textContent =
      "2:00";

  }

  setSidebar(
    `🔄 ${message}`
  );

  updateFreeUI();

  updateButtons();

  try {

    await RandomVideoMatcher.startRandomVideoCall();

    attachLocalStream();

  } catch (error) {

    console.error(
      "Random Video search error",
      error
    );

    searchRunning =
      false;

    callActive =
      false;

    callConnected =
      false;

    setStatus(
      "Connection error",
      "Check the backend server and camera/microphone permissions."
    );

    updateButtons();

  }

}


/* =========================================================
   FINISH CALL
========================================================= */

async function finishCall(
  message = "Call ended."
) {

  callActive =
    false;

  callConnected =
    false;

  searchRunning =
    false;

  nextPending =
    false;

  stopTimer();

  await RandomVideoMatcher.endVideoCall();

  prepareVideoUI();

  if (remoteVideo) {

    remoteVideo.srcObject =
      null;

  }

  if (localVideo) {

    localVideo.srcObject =
      null;

  }

  clearChat();

  setChatEnabled(
    false
  );

  setStatus(
    "Call ended",
    message
  );

  updateButtons();

}


/* =========================================================
   TIME LIMIT
========================================================= */

async function endCallDueToTimeLimit() {

  if (!callActive) {

    return;

  }

  await consumeFreeAttempt();

  await finishCall(
    "Your 2-minute free video call has ended."
  );

  alert(
    "Your 2-minute free video call has ended."
  );

  if (
    getFreeCount() <= 0
  ) {

    window.location.href =
      "wallet.html";

  }

}


/* =========================================================
   NEXT PERSON
========================================================= */

async function nextPerson() {

  if (
    nextPending ||
    searchRunning
  ) {

    return;

  }

  if (
    getFreeCount() <= 0
  ) {

    updateFreeUI();

    alert(
      "No free video calls remaining. Please visit your wallet."
    );

    return;

  }

  nextPending =
    true;

  callActive =
    false;

  callConnected =
    false;

  freeAttemptConsumed =
    false;

  stopTimer();

  clearChat();

  setChatEnabled(
    false
  );

  setSidebar(
    "🔄 Finding the next random person..."
  );

  if (callerName) {

    callerName.textContent =
      "Finding...";

  }

  showLoadingText();

  updateButtons();

  try {

    await RandomVideoMatcher.nextVideo();

  } catch (error) {

    console.error(
      "Next video error",
      error
    );

    nextPending =
      false;

    setStatus(
      "Error",
      "Could not find the next person."
    );

    updateButtons();

  }

}


/* =========================================================
   MUTE
========================================================= */

function toggleMute() {

  isMuted =
    !isMuted;

  RandomVideoMatcher.setMuted(
    isMuted
  );

  if (muteMicBtn) {

    muteMicBtn.textContent =
      isMuted
        ? "🔇"
        : "🎤";

    muteMicBtn.style.opacity =
      isMuted
        ? "0.5"
        : "1";

  }

}


/* =========================================================
   CAMERA
========================================================= */

function toggleCamera() {

  isCameraOn =
    !isCameraOn;

  RandomVideoMatcher.setCameraEnabled(
    isCameraOn
  );

  if (toggleCameraBtn) {

    toggleCameraBtn.style.opacity =
      isCameraOn
        ? "1"
        : "0.5";

  }

  if (localVideo) {

    localVideo.style.opacity =
      isCameraOn
        ? "1"
        : "0.5";

  }

}


/* =========================================================
   REPORT
========================================================= */

async function reportUser() {

  if (
    !RandomVideoMatcher.getMatchedUser()
  ) {

    return;

  }

  const reason =
    window.prompt(
      "Why are you reporting this person?",
      "Inappropriate behaviour"
    );

  if (
    reason === null
  ) {

    return;

  }

  const ok =
    await RandomVideoMatcher.reportUser(
      reason.trim() ||
        "No reason provided"
    );

  if (ok) {

    alert(
      "Report submitted."
    );

    await finishCall(
      "Report submitted. Call ended."
    );

  } else {

    alert(
      "Unable to submit the report."
    );

  }

}


/* =========================================================
   BLOCK
========================================================= */

async function blockUser() {

  const partner =
    RandomVideoMatcher.getMatchedUser();

  if (!partner) {

    return;

  }

  const confirmed =
    window.confirm(
      "Block this person and end the call?"
    );

  if (!confirmed) {

    return;

  }

  const ok =
    await RandomVideoMatcher.blockUser();

  if (ok) {

    alert(
      "User blocked."
    );

    await finishCall(
      "User blocked. Call ended."
    );

  } else {

    alert(
      "Unable to block this user."
    );

  }

}


/* =========================================================
   MATCHER EVENTS
========================================================= */

function bindMatcherEvents() {

  RandomVideoMatcher.onMatch(
    async (
      partner,
      data = {}
    ) => {

      if (data.waiting) {

        searchRunning =
          true;

        callActive =
          false;

        callConnected =
          false;

        setChatEnabled(
          false
        );

        setStatus(
          "Finding...",
          "Waiting for a random video-call partner..."
        );

        updateButtons();

        return;

      }

      if (!partner) {

        return;

      }

      searchRunning =
        false;

      callActive =
        true;

      callConnected =
        false;

      clearChat();

      setChatEnabled(
        false
      );

      nextPending =
        false;

      if (callerName) {

        callerName.textContent =
          partner.displayName ||
          "Stranger";

      }

      setStatus(
        "Person found",
        "Random person found. Starting video..."
      );

      attachLocalStream();

      startTimer();

      updateButtons();

      const consumed =
        await consumeFreeAttempt();

      if (!consumed) {

        await finishCall(
          "Free video-call count update failed."
        );

        alert(
          "Unable to start the free video call."
        );

        return;

      }

    }
  );


  RandomVideoMatcher.onRemoteStream(
    (stream) => {

      attachRemoteStream(
        stream
      );

    }
  );


  RandomVideoMatcher.onConnectionState(
    (state) => {

      if (
        state ===
        "connected"
      ) {

        callActive =
          true;

        setChatEnabled(
          true
        );

        callConnected =
          true;

        searchRunning =
          false;

        const partner =
          RandomVideoMatcher.getMatchedUser();

        if (callerName) {

          callerName.textContent =
            partner?.displayName ||
            "Stranger";

        }

        setStatus(
          "Connected",
          "Video call connected! Be respectful and kind."
        );

        startTimer();

        updateButtons();

      } else if (
        state ===
        "connecting"
      ) {

        setStatus(
          callerName?.textContent ||
            "Connecting...",
          "Establishing video connection..."
        );

      } else if (
        state ===
        "failed"
      ) {

        callConnected =
          false;

        setChatEnabled(
          false
        );

        setStatus(
          "Connection failed",
          "Next Person try pannunga."
        );

        updateButtons();

      } else if (
        state ===
        "disconnected"
      ) {

        callConnected =
          false;

        setChatEnabled(
          false
        );

        setStatus(
          callerName?.textContent ||
            "Disconnected",
          "Video connection disconnected."
        );

        updateButtons();

      }

    }
  );


  RandomVideoMatcher.onChatMessage(
    (data = {}) => {

      if (
        data.message
      ) {

        addChatMessage(
          data.message,
          "theirs"
        );

      }

    }
  );


  RandomVideoMatcher.onPartnerEnded(
    (data = {}) => {

      callActive =
        false;

      setChatEnabled(
        false
      );

      callConnected =
        false;

      searchRunning =
        false;

      stopTimer();

      clearChat();

      if (remoteVideo) {

        remoteVideo.srcObject =
          null;

      }

      setStatus(
        "Partner left",
        data.message ||
          "Your partner left the call."
      );

      updateButtons();

    }
  );


  RandomVideoMatcher.onNextReady(
    async () => {

      nextPending =
        false;

      await startSearch(
        "Finding the next random person..."
      );

    }
  );


  RandomVideoMatcher.onServerError(
    (message) => {

      searchRunning =
        false;

      callActive =
        false;

      callConnected =
        false;

      nextPending =
        false;

      setStatus(
        "Error",
        message ||
          "Random video server error."
      );

      updateButtons();

    }
  );


  RandomVideoMatcher.onMediaError(
    (error) => {

      searchRunning =
        false;

      callActive =
        false;

      callConnected =
        false;

      let message =
        "Camera and microphone permission are required.";

      if (
        error?.name ===
        "NotAllowedError"
      ) {

        message =
          "Camera/microphone permission denied. Allow access in the browser.";

      }

      if (
        error?.name ===
        "NotFoundError"
      ) {

        message =
          "Camera or microphone was not found.";

      }

      if (
        error?.name ===
        "NotReadableError"
      ) {

        message =
          "Camera or microphone is already being used by another application.";

      }

      setStatus(
        "Permission required",
        message
      );

      updateButtons();

    }
  );

}


/* =========================================================
   MENUS
========================================================= */

function initMenus() {

  mobileMenuBtn?.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      mobileNav?.classList.toggle(
        "show"
      );

    }
  );


  rewardsMenuBtn?.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      rewardsMenu?.classList.toggle(
        "show"
      );

      profileMenu?.classList.remove(
        "show"
      );

    }
  );


  profileMenuBtn?.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      profileMenu?.classList.toggle(
        "show"
      );

      rewardsMenu?.classList.remove(
        "show"
      );

    }
  );


  document.addEventListener(
    "click",
    () => {

      rewardsMenu?.classList.remove(
        "show"
      );

      profileMenu?.classList.remove(
        "show"
      );

    }
  );


  document
    .querySelectorAll(
      ".mobile-nav-link"
    )
    .forEach(
      (link) => {

        link.addEventListener(
          "click",
          () => {

            mobileNav?.classList.remove(
              "show"
            );

          }
        );

      }
    );

}


/* =========================================================
   CHAT BUTTON
========================================================= */

videoChatSendBtn?.addEventListener(
  "click",
  sendChatMessage
);


/* =========================================================
   CHAT ENTER
========================================================= */

videoChatInput?.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();

      sendChatMessage();

    }

  }
);


setChatEnabled(
  false
);


/* =========================================================
   BUTTON EVENTS
========================================================= */

endCallBtn?.addEventListener(
  "click",
  () => {

    finishCall();

  }
);


muteMicBtn?.addEventListener(
  "click",
  toggleMute
);


toggleCameraBtn?.addEventListener(
  "click",
  toggleCamera
);


nextBtn?.addEventListener(
  "click",
  nextPerson
);


reportBtn?.addEventListener(
  "click",
  reportUser
);


blockBtn?.addEventListener(
  "click",
  blockUser
);


/* =========================================================
   LOGOUT
========================================================= */

dropdownLogoutBtn?.addEventListener(
  "click",
  async () => {

    await RandomVideoMatcher.endVideoCall();

    await handleLogout();

  }
);


mobileLogoutBtn?.addEventListener(
  "click",
  async () => {

    await RandomVideoMatcher.endVideoCall();

    await handleLogout();

  }
);


/* =========================================================
   INIT MENUS
========================================================= */

initMenus();


/* =========================================================
   AUTH
========================================================= */

protectPage().then(
  (success) => {

    if (!success) {

      return;

    }

    onAuthReady(
      async (
        user,
        profile
      ) => {

        if (
          !user ||
          !profile
        ) {

          return;

        }

        authenticated =
          true;

        updateUserUI();

        updateFreeUI();

        prepareVideoUI();

        bindMatcherEvents();

        try {

          await RandomVideoMatcher.ensureSocket();

          updateButtons();

          if (
            getFreeCount() > 0
          ) {

            setTimeout(
              () => {

                startSearch(
                  "Finding a random video person..."
                );

              },
              300
            );

          } else {

            setStatus(
              "No free calls",
              "Use diamonds from Wallet to continue."
            );

            updateButtons();

          }

        } catch (error) {

          console.error(
            "Socket initialization error",
            error
          );

          setStatus(
            "Offline",
            "ConnectNow server connection failed."
          );

          updateButtons();

        }

      }
    );

  }
);


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {

    if (
      window.innerWidth >
      900
    ) {

      mobileNav?.classList.remove(
        "show"
      );

    }

  }
);


/* =========================================================
   BEFORE UNLOAD
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    stopTimer();

    try {

      RandomVideoMatcher.disconnect();

    } catch {}

  }
);