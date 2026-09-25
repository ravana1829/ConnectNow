/* =========================================================
   CONNECTNOW RANDOM VIDEO CALL PAGE
   OLD UI PRESERVED
   REAL SOCKET.IO + WEBRTC
   ========================================================= */

import {
  protectPage,
  onAuthReady,
  currentProfile,
  handleLogout,
  decrementFreeRandomVideoChat,
  setAvatar
} from "./auth-helper.js";

import RandomVideoMatcher
  from "./random-video-matcher.js";


/* =========================================================
   ELEMENTS
   ========================================================= */

const mobileMenuBtn =
  document.getElementById("mobileMenuBtn");

const mobileNav =
  document.getElementById("mobileNav");

const rewardsMenuBtn =
  document.getElementById("rewardsMenuBtn");

const rewardsMenu =
  document.getElementById("rewardsMenu");

const profileMenuBtn =
  document.getElementById("profileMenuBtn");

const profileMenu =
  document.getElementById("profileMenu");

const dropdownLogoutBtn =
  document.getElementById("dropdownLogoutBtn");

const mobileLogoutBtn =
  document.getElementById("mobileLogoutBtn");


/* =========================================================
   USER UI
   ========================================================= */

const navUserName =
  document.getElementById("navUserName");

const navUserAvatar =
  document.getElementById("navUserAvatar");

const dropdownUserName =
  document.getElementById("dropdownUserName");

const dropdownUserEmail =
  document.getElementById("dropdownUserEmail");

const dropdownUserAvatar =
  document.getElementById("dropdownUserAvatar");


/* =========================================================
   VIDEO UI
   ========================================================= */

const remoteVideo =
  document.getElementById("remoteVideo");

const localVideo =
  document.getElementById("localVideo");

const remoteVideoPlaceholder =
  document.getElementById(
    "remoteVideoPlaceholder"
  );

const localVideoPlaceholder =
  document.getElementById(
    "localVideoPlaceholder"
  );

const videoPlaceholder =
  document.getElementById(
    "videoPlaceholder"
  );


/* =========================================================
   CALL UI
   ========================================================= */

const callHeader =
  document.getElementById("callHeader");

const callerName =
  document.getElementById("callerName");

const callTimer =
  document.getElementById("callTimer");

const statusText =
  document.getElementById("statusText");

const infoText =
  document.getElementById("infoText");

const videoNotification =
  document.getElementById(
    "videoNotification"
  );


/* =========================================================
   SIDEBAR
   ========================================================= */

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


/* =========================================================
   BUTTONS
   ========================================================= */

const startBtn =
  document.getElementById("startBtn");

const nextBtn =
  document.getElementById("nextBtn");

const endBtn =
  document.getElementById("endBtn");

const backBtn =
  document.getElementById("backBtn");

const muteMicBtn =
  document.getElementById("muteMicBtn");

const toggleCameraBtn =
  document.getElementById(
    "toggleCameraBtn"
  );

const videoReportBtn =
  document.getElementById(
    "videoReportBtn"
  );

const videoBlockBtn =
  document.getElementById(
    "videoBlockBtn"
  );


/* =========================================================
   CHAT
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

let pageReady =
  false;

let callActive =
  false;

let callConnected =
  false;

let searching =
  false;

let startingCall =
  false;

let nextInProgress =
  false;

let isMuted =
  false;

let isCameraOn =
  true;

let currentSocket =
  null;

let chatListenersAttached =
  false;

let timerInterval =
  null;

let callStartTime =
  null;

let currentPartnerUserId =
  null;

let currentPartnerSocketId =
  null;

let countedThisCall =
  false;


/*
  Preserve the old 2:00 timer.
*/
const FREE_CALL_DURATION =
  120;


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializePage() {

  try {

    const protectedResult =
      await protectPage();


    if (!protectedResult) {
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


        pageReady =
          true;


        updateUserUI();

        updateFreeUsageUI();

        updateButtons();

        attachMatcherCallbacks();


        /*
          Prepare Socket.IO once.
          Important:
          We use the socket inside RandomVideoMatcher.
          We DO NOT create another socket here.
        */
        try {

          currentSocket =
            await RandomVideoMatcher.ensureSocket();

          attachChatSocketEvents();

        } catch (error) {

          console.error(
            "Random Video socket initialization error:",
            error
          );

          showStatus(
            "Disconnected",
            "Unable to connect to ConnectNow server."
          );

        }


        /*
          Automatically start when free calls are available.
        */
        setTimeout(
          () => {

            if (
              pageReady &&
              getFreeCount() > 0 &&
              !callActive &&
              !searching &&
              !startingCall
            ) {

              startCall();

            }

          },
          500
        );

      }
    );

  } catch (error) {

    console.error(
      "Video page initialization error:",
      error
    );


    showStatus(
      "Error",
      "Unable to initialize Video Call."
    );

  }

}


/* =========================================================
   START INITIALIZATION
   ========================================================= */

initializePage();


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


  if (
    navUserName
  ) {

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
    currentProfile?.photoURL || "",
    name
  );


  setAvatar(
    dropdownUserAvatar,
    currentProfile?.photoURL || "",
    name
  );

}


/* =========================================================
   FREE COUNT
   ========================================================= */

function getFreeCount() {

  return Number(
    currentProfile?.randomVideoChatFreeCount ||
    0
  );

}


function updateFreeUsageUI() {

  const count =
    getFreeCount();


  if (
    noFreeWarning
  ) {

    noFreeWarning.style.display =
      count <= 0
        ? "block"
        : "none";

  }


  if (
    timeLimitWarning
  ) {

    timeLimitWarning.style.display =
      count > 0
        ? "block"
        : "none";

  }


  if (
    count <= 0
  ) {

    showSidebar(
      "❌ No free video calls remaining. Please use your wallet to continue."
    );

  }

}


/* =========================================================
   STATUS
   ========================================================= */

function showStatus(
  status,
  message
) {

  if (
    statusText
  ) {

    statusText.textContent =
      status;

  }


  if (
    infoText
  ) {

    infoText.textContent =
      message;

  }

}


/* =========================================================
   NOTIFICATION
   ========================================================= */

function showNotification(
  message
) {

  if (
    !videoNotification
  ) {

    return;

  }


  videoNotification.textContent =
    String(
      message ||
      ""
    );


  videoNotification.classList.add(
    "show"
  );


  setTimeout(
    () => {

      videoNotification.classList.remove(
        "show"
      );

    },
    3500
  );

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function showSidebar(
  message
) {

  if (
    !sidebarContent
  ) {

    return;

  }


  sidebarContent.textContent =
    "";


  const p =
    document.createElement(
      "p"
    );


  p.textContent =
    String(
      message ||
      ""
    );


  sidebarContent.appendChild(
    p
  );

}


/* =========================================================
   BUTTON STATE
   ========================================================= */

function updateButtons() {

  const hasCall =
    Boolean(
      callActive &&
      RandomVideoMatcher.getRoomId()
    );


  if (
    startBtn
  ) {

    startBtn.disabled =
      callActive ||
      searching ||
      startingCall;

  }


  if (
    nextBtn
  ) {

    nextBtn.disabled =
      startingCall ||
      nextInProgress;

  }


  if (
    endBtn
  ) {

    endBtn.disabled =
      !hasCall;

  }


  if (
    muteMicBtn
  ) {

    muteMicBtn.disabled =
      !hasCall;

  }


  if (
    toggleCameraBtn
  ) {

    toggleCameraBtn.disabled =
      !hasCall;

  }


  if (
    videoReportBtn
  ) {

    videoReportBtn.disabled =
      !hasCall;

  }


  if (
    videoBlockBtn
  ) {

    videoBlockBtn.disabled =
      !hasCall;

  }


  if (
    videoChatInput
  ) {

    videoChatInput.disabled =
      !callConnected;

  }


  if (
    videoChatSendBtn
  ) {

    videoChatSendBtn.disabled =
      !callConnected;

  }

}


/* =========================================================
   CLEAR CHAT
   ========================================================= */

function clearChat() {

  if (
    videoChatMessages
  ) {

    videoChatMessages.innerHTML =
      "";

  }

}


/* =========================================================
   ADD CHAT MESSAGE
   ========================================================= */

function addChatMessage(
  message,
  type
) {

  if (
    !videoChatMessages
  ) {

    return;

  }


  const cleanMessage =
    String(
      message ||
      ""
    ).trim();


  if (
    !cleanMessage
  ) {

    return;

  }


  const element =
    document.createElement(
      "div"
    );


  element.className =
    `video-chat-message ${type}`;


  element.textContent =
    cleanMessage;


  videoChatMessages.appendChild(
    element
  );


  videoChatMessages.scrollTop =
    videoChatMessages.scrollHeight;

}


/* =========================================================
   CHAT SOCKET EVENTS
   ========================================================= */

function attachChatSocketEvents() {

  if (
    chatListenersAttached ||
    !currentSocket
  ) {

    return;

  }


  chatListenersAttached =
    true;


  currentSocket.on(
    "videoChatMessage",
    (
      data = {}
    ) => {

      /*
        Only display partner messages.
      */
      if (
        data.userId &&
        currentProfile?.userId &&
        data.userId ===
          currentProfile.userId
      ) {

        return;

      }


      if (
        !callActive
      ) {

        return;

      }


      addChatMessage(
        data.message,
        "theirs"
      );

    }
  );


  currentSocket.on(
    "reportSubmitted",
    () => {

      showNotification(
        "Report submitted."
      );

    }
  );


  currentSocket.on(
    "userBlocked",
    () => {

      showNotification(
        "User blocked."
      );

    }
  );

}


/* =========================================================
   MATCHER CALLBACKS
   ========================================================= */

let matcherCallbacksAttached =
  false;


function attachMatcherCallbacks() {

  if (
    matcherCallbacksAttached
  ) {

    return;

  }


  matcherCallbacksAttached =
    true;


  /* =======================================================
     MATCH
     ======================================================= */

  RandomVideoMatcher.onMatch(
    (
      partner,
      data = {}
    ) => {

      if (
        data.waiting
      ) {

        searching =
          true;

        callActive =
          false;

        callConnected =
          false;


        showStatus(
          "Searching...",
          "Finding a random video-call partner..."
        );


        showSidebar(
          "🔍 Searching for a random person..."
        );


        if (
          callerName
        ) {

          callerName.textContent =
            "Connecting...";

        }


        updateButtons();


        return;

      }


      if (
        !partner
      ) {

        return;

      }


      searching =
        false;

      callActive =
        true;

      callConnected =
        false;


      currentPartnerUserId =
        partner.userId ||
        partner.uid ||
        partner.id ||
        null;


      currentPartnerSocketId =
        partner.socketId ||
        null;


      const partnerName =
        partner.displayName ||
        "Stranger";


      if (
        callerName
      ) {

        callerName.textContent =
          partnerName;

      }


      if (
        callHeader
      ) {

        callHeader.style.display =
          "block";

      }


      showStatus(
        "Connecting...",
        `Connecting with ${partnerName}...`
      );


      showSidebar(
        `🔄 Connecting you with ${partnerName}...`
      );


      showNotification(
        "Random person connected!"
      );


      clearChat();


      setChatEnabled(
        false
      );


      showRemotePlaceholder(
        true
      );


      updateButtons();

    }
  );


  /* =======================================================
     REMOTE STREAM
     ======================================================= */

  RandomVideoMatcher.onRemoteStream(
    (
      stream
    ) => {

      if (
        !remoteVideo
      ) {

        return;

      }


      remoteVideo.srcObject =
        stream;


      showRemotePlaceholder(
        false
      );


      const playPromise =
        remoteVideo.play();


      if (
        playPromise &&
        typeof playPromise.catch ===
          "function"
      ) {

        playPromise.catch(
          (
            error
          ) => {

            console.warn(
              "Remote video play warning:",
              error
            );

          }
        );

      }


      callConnected =
        true;

      callActive =
        true;

      searching =
        false;


      setChatEnabled(
        true
      );


      const partner =
        RandomVideoMatcher.getMatchedUser();


      showStatus(
        "Connected",
        `${partner?.displayName || "Stranger"} is now connected`
      );


      showSidebar(
        "✅ Video call connected. You can now talk with the other person."
      );


      if (
        callStartTime === null
      ) {

        startTimer();

      }


      updateButtons();

    }
  );


  /* =======================================================
     CONNECTION STATE
     ======================================================= */

  RandomVideoMatcher.onConnectionState(
    (
      state
    ) => {

      console.log(
        "Random Video connection state:",
        state
      );


      switch (
        state
      ) {

        case "new":

          showStatus(
            "Connecting...",
            "Preparing video connection..."
          );

          break;


        case "connecting":

          showStatus(
            "Connecting...",
            "Establishing secure video connection..."
          );

          break;


        case "connected":

          callActive =
            true;

          callConnected =
            true;

          searching =
            false;


          setChatEnabled(
            true
          );


          if (
            callStartTime === null
          ) {

            startTimer();

          }


          showRemotePlaceholder(
            false
          );


          showStatus(
            "Connected",
            "Random person-oda video call connected!"
          );


          showSidebar(
            "✅ Video connection is active."
          );


          updateButtons();

          break;


        case "disconnected":

          callConnected =
            false;


          showStatus(
            "Disconnected",
            "Video connection was interrupted."
          );


          showSidebar(
            "⚠️ Video connection was interrupted."
          );


          updateButtons();

          break;


        case "failed":

          callConnected =
            false;


          showStatus(
            "Failed",
            "Video connection failed. Please try Next Person."
          );


          showSidebar(
            "❌ Video connection failed. Try Next Person."
          );


          updateButtons();

          break;


        case "closed":

          callConnected =
            false;

          break;

      }

    }
  );


  /* =======================================================
     PARTNER ENDED
     ======================================================= */

  RandomVideoMatcher.onPartnerEnded(
    () => {

      callActive =
        false;

      callConnected =
        false;

      searching =
        false;


      stopTimer();


      clearVideoStreams();

      setChatEnabled(
        false
      );


      currentPartnerUserId =
        null;

      currentPartnerSocketId =
        null;


      showStatus(
        "Partner left",
        "Your partner left the call."
      );


      showSidebar(
        "📞 The other person has left the call."
      );


      showNotification(
        "Your partner left the call."
      );


      updateButtons();

    }
  );


  /* =======================================================
     NEXT READY
     ======================================================= */

  RandomVideoMatcher.onNextReady(
    () => {

      searching =
        true;

      callActive =
        false;

      callConnected =
        false;


      showStatus(
        "Searching...",
        "Finding the next random person..."
      );


      showSidebar(
        "🔄 Finding the next random person..."
      );


      updateButtons();

    }
  );


  /* =======================================================
     SERVER ERROR
     ======================================================= */

  RandomVideoMatcher.onServerError(
    (
      message
    ) => {

      searching =
        false;

      callActive =
        false;

      callConnected =
        false;


      showStatus(
        "Error",
        message ||
        "Random video server error."
      );


      showSidebar(
        `❌ ${
          message ||
          "Random video server error."
        }`
      );


      updateButtons();

    }
  );


  /* =======================================================
     MEDIA ERROR
     ======================================================= */

  RandomVideoMatcher.onMediaError(
    (
      error
    ) => {

      searching =
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
          "❌ Camera/microphone permission was denied. Please allow access.";

      }


      else if (
        error?.name ===
        "NotFoundError"
      ) {

        message =
          "❌ Camera or microphone was not found.";

      }


      else if (
        error?.name ===
        "NotReadableError"
      ) {

        message =
          "❌ Camera or microphone is already being used by another application.";

      }


      showStatus(
        "Permission required",
        message
      );


      showSidebar(
        message
      );


      showNotification(
        message
      );


      updateButtons();

    }
  );

}


/* =========================================================
   START CALL
   ========================================================= */

async function startCall() {

  if (
    !pageReady ||
    startingCall ||
    searching ||
    callActive
  ) {

    return;

  }


  const freeCount =
    getFreeCount();


  if (
    freeCount <= 0
  ) {

    updateFreeUsageUI();


    alert(
      "No free video calls remaining. Please visit your wallet."
    );


    return;

  }


  startingCall =
    true;

  searching =
    true;

  callActive =
    false;

  callConnected =
    false;

  countedThisCall =
    false;


  stopTimer();

  clearVideoStreams();

  clearChat();


  currentPartnerUserId =
    null;

  currentPartnerSocketId =
    null;


  setChatEnabled(
    false
  );


  showRemotePlaceholder(
    true
  );


  if (
    callHeader
  ) {

    callHeader.style.display =
      "block";

  }


  if (
    callerName
  ) {

    callerName.textContent =
      "Connecting...";

  }


  if (
    callTimer
  ) {

    callTimer.textContent =
      "2:00";

  }


  showStatus(
    "Connecting...",
    "Preparing your camera and microphone..."
  );


  showSidebar(
    "🎥 Preparing your camera and microphone..."
  );


  showNotification(
    "Starting camera and microphone..."
  );


  updateButtons();


  try {

    /*
      Start the actual:
      camera
      microphone
      Socket.IO
      random matching
      WebRTC
    */
    await RandomVideoMatcher.startRandomVideoCall();


    /*
      Show local camera.
    */
    attachLocalStream();


    /*
      Decrement only once for this call attempt.
    */
    if (
      !countedThisCall
    ) {

      const updated =
        await decrementFreeRandomVideoChat();


      if (
        updated
      ) {

        countedThisCall =
          true;

        updateFreeUsageUI();

      }

    }


    showStatus(
      "Searching...",
      "Finding a random person..."
    );


    showSidebar(
      "🔍 Searching for a random video-call partner..."
    );


  } catch (
    error
  ) {

    console.error(
      "Start random video error:",
      error
    );


    searching =
      false;

    callActive =
      false;

    callConnected =
      false;


    showStatus(
      "Error",
      "Unable to start Random Video."
    );


    showSidebar(
      "❌ Unable to start Random Video. Make sure camera/microphone permission is allowed and backend is running."
    );


  } finally {

    startingCall =
      false;

    updateButtons();

  }

}


/* =========================================================
   LOCAL STREAM
   ========================================================= */

function attachLocalStream() {

  const stream =
    RandomVideoMatcher.getLocalStream();


  if (
    !stream ||
    !localVideo
  ) {

    return;

  }


  localVideo.srcObject =
    stream;


  if (
    localVideoPlaceholder
  ) {

    localVideoPlaceholder.style.display =
      "none";

  }


  localVideo.style.opacity =
    "1";


  const playPromise =
    localVideo.play();


  if (
    playPromise &&
    typeof playPromise.catch ===
      "function"
  ) {

    playPromise.catch(
      () => {}
    );

  }

}


/* =========================================================
   REMOTE PLACEHOLDER
   ========================================================= */

function showRemotePlaceholder(
  visible
) {

  if (
    remoteVideoPlaceholder
  ) {

    remoteVideoPlaceholder.style.display =
      visible
        ? "block"
        : "none";

  }


  if (
    videoPlaceholder
  ) {

    /*
      The old HTML has its own large placeholder.
      Hide it once remote video appears.
    */
    videoPlaceholder.style.display =
      visible
        ? "flex"
        : "none";

  }

}


/* =========================================================
   CLEAR VIDEO
   ========================================================= */

function clearVideoStreams() {

  if (
    remoteVideo
  ) {

    remoteVideo.srcObject =
      null;

  }


  if (
    localVideo
  ) {

    localVideo.srcObject =
      null;

  }


  if (
    localVideoPlaceholder
  ) {

    localVideoPlaceholder.style.display =
      "block";

  }


  showRemotePlaceholder(
    true
  );

}


/* =========================================================
   ENABLE / DISABLE CHAT
   ========================================================= */

function setChatEnabled(
  enabled
) {

  if (
    videoChatInput
  ) {

    videoChatInput.disabled =
      !enabled;

  }


  if (
    videoChatSendBtn
  ) {

    videoChatSendBtn.disabled =
      !enabled;

  }


  if (
    videoReportBtn
  ) {

    videoReportBtn.disabled =
      !enabled;

  }


  if (
    videoBlockBtn
  ) {

    videoBlockBtn.disabled =
      !enabled;

  }

}


/* =========================================================
   SEND CHAT MESSAGE
   ========================================================= */

function sendChatMessage() {

  if (
    !callConnected ||
    !currentSocket ||
    !currentSocket.connected
  ) {

    return;

  }


  const message =
    String(
      videoChatInput?.value ||
      ""
    ).trim();


  if (
    !message
  ) {

    return;

  }


  if (
    message.length > 500
  ) {

    return;

  }


  /*
    Existing backend expects videoChatMessage.
  */
  currentSocket.emit(
    "videoChatMessage",
    {

      message

    }
  );


  /*
    Show own message immediately.
  */
  addChatMessage(
    message,
    "mine"
  );


  videoChatInput.value =
    "";


  videoChatInput.focus();

}


/* =========================================================
   MUTE
   ========================================================= */

function toggleMute() {

  const stream =
    RandomVideoMatcher.getLocalStream();


  if (
    !stream
  ) {

    return;

  }


  isMuted =
    !isMuted;


  const audioTracks =
    stream.getAudioTracks();


  audioTracks.forEach(
    (
      track
    ) => {

      track.enabled =
        !isMuted;

    }
  );


  if (
    muteMicBtn
  ) {

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

  const stream =
    RandomVideoMatcher.getLocalStream();


  if (
    !stream
  ) {

    return;

  }


  isCameraOn =
    !isCameraOn;


  const videoTracks =
    stream.getVideoTracks();


  videoTracks.forEach(
    (
      track
    ) => {

      track.enabled =
        isCameraOn;

    }
  );


  if (
    toggleCameraBtn
  ) {

    toggleCameraBtn.textContent =
      isCameraOn
        ? "📹"
        : "🚫";


    toggleCameraBtn.style.opacity =
      isCameraOn
        ? "1"
        : "0.5";

  }


  if (
    localVideo
  ) {

    localVideo.style.opacity =
      isCameraOn
        ? "1"
        : "0.35";

  }

}


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {

  stopTimer();


  callStartTime =
    Date.now();


  if (
    callTimer
  ) {

    callTimer.textContent =
      "2:00";

  }


  timerInterval =
    setInterval(
      () => {

        if (
          !callActive
        ) {

          stopTimer();

          return;

        }


        const elapsed =
          Math.floor(
            (
              Date.now() -
              callStartTime
            ) /
            1000
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


        if (
          callTimer
        ) {

          callTimer.textContent =
            `${minutes}:${String(
              seconds
            ).padStart(
              2,
              "0"
            )}`;

        }


        if (
          remaining <= 0
        ) {

          endCallDueToTimeLimit();

        }

      },
      1000
    );

}


/* =========================================================
   STOP TIMER
   ========================================================= */

function stopTimer() {

  if (
    timerInterval
  ) {

    clearInterval(
      timerInterval
    );

    timerInterval =
      null;

  }


  callStartTime =
    null;

}


/* =========================================================
   TIME LIMIT
   ========================================================= */

async function endCallDueToTimeLimit() {

  if (
    !callActive
  ) {

    return;

  }


  await endCall(
    false
  );


  alert(
    "Your 2-minute free video call has ended."
  );

}


/* =========================================================
   END CALL
   ========================================================= */

async function endCall(
  showMessage = true
) {

  callActive =
    false;

  callConnected =
    false;

  searching =
    false;

  stopTimer();


  try {

    await RandomVideoMatcher.endVideoCall();

  } catch (
    error
  ) {

    console.error(
      "End video call error:",
      error
    );

  }


  clearVideoStreams();

  setChatEnabled(
    false
  );


  currentPartnerUserId =
    null;

  currentPartnerSocketId =
    null;


  if (
    callerName
  ) {

    callerName.textContent =
      "Call Ended";

  }


  showStatus(
    "Call ended",
    "Start Call click panni again start pannalam."
  );


  showSidebar(
    "📞 Call ended. You can start another call."
  );


  if (
    showMessage
  ) {

    showNotification(
      "Video call ended."
    );

  }


  updateButtons();

}


/* =========================================================
   NEXT PERSON
   ========================================================= */

async function nextPerson() {

  if (
    nextInProgress ||
    startingCall
  ) {

    return;

  }


  if (
    getFreeCount() <= 0
  ) {

    updateFreeUsageUI();


    alert(
      "No free video calls remaining."
    );


    return;

  }


  nextInProgress =
    true;

  callActive =
    false;

  callConnected =
    false;

  searching =
    true;


  stopTimer();

  clearVideoStreams();

  clearChat();

  setChatEnabled(
    false
  );


  currentPartnerUserId =
    null;

  currentPartnerSocketId =
    null;


  showStatus(
    "Searching...",
    "Finding the next random person..."
  );


  showSidebar(
    "🔄 Finding the next random person..."
  );


  showNotification(
    "Moving to the next random person..."
  );


  updateButtons();


  try {

    /*
      End current room and ask backend
      to put this socket into next search.
    */
    await RandomVideoMatcher.nextVideo();


    /*
      Make sure local camera still exists.
    */
    if (
      !RandomVideoMatcher.getLocalStream()
    ) {

      await RandomVideoMatcher.getUserMedia();

    }


    attachLocalStream();


    /*
      Count the new attempt.
    */
    countedThisCall =
      false;


    const updated =
      await decrementFreeRandomVideoChat();


    if (
      updated
    ) {

      countedThisCall =
        true;

      updateFreeUsageUI();

    }

  } catch (
    error
  ) {

    console.error(
      "Next random video error:",
      error
    );


    searching =
      false;


    showStatus(
      "Error",
      "Unable to find the next person."
    );


    showSidebar(
      "❌ Unable to find the next person. Please try again."
    );

  } finally {

    nextInProgress =
      false;

    updateButtons();

  }

}


/* =========================================================
   REPORT USER
   ========================================================= */

async function reportUser() {

  if (
    !currentPartnerUserId
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


  const cleanReason =
    reason.trim() ||
    "No reason provided";


  /*
    Persist report using Firestore.
  */
  const submitted =
    await RandomVideoMatcher.reportUser(
      cleanReason
    );


  /*
    Also notify the backend session.
  */
  if (
    currentSocket &&
    currentSocket.connected
  ) {

    currentSocket.emit(
      "reportUser",
      {

        userId:
          currentPartnerUserId,

        reason:
          cleanReason

      }
    );

  }


  if (
    submitted
  ) {

    showNotification(
      "Report submitted."
    );


    await endCall();

  } else {

    showNotification(
      "Unable to submit report."
    );

  }

}


/* =========================================================
   BLOCK USER
   ========================================================= */

async function blockUser() {

  if (
    !currentPartnerUserId
  ) {

    return;

  }


  const confirmed =
    window.confirm(
      "Block this person and move to another random person?"
    );


  if (
    !confirmed
  ) {

    return;

  }


  const blocked =
    await RandomVideoMatcher.blockUser(
      currentPartnerUserId
    );


  if (
    currentSocket &&
    currentSocket.connected
  ) {

    currentSocket.emit(
      "blockUser",
      {

        userId:
          currentPartnerUserId

      }
    );

  }


  if (
    blocked
  ) {

    showNotification(
      "User blocked."
    );


    await endCall();

  } else {

    showNotification(
      "Unable to block this user."
    );

  }

}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

startBtn?.addEventListener(
  "click",
  startCall
);


nextBtn?.addEventListener(
  "click",
  nextPerson
);


endBtn?.addEventListener(
  "click",
  () => {

    endCall();

  }
);


backBtn?.addEventListener(
  "click",
  async () => {

    try {

      await RandomVideoMatcher.endVideoCall();

    } catch (
      error
    ) {

      console.warn(
        "Back cleanup warning:",
        error
      );

    }


    window.location.href =
      "./index.html";

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


videoReportBtn?.addEventListener(
  "click",
  reportUser
);


videoBlockBtn?.addEventListener(
  "click",
  blockUser
);


/* =========================================================
   CHAT SEND
   ========================================================= */

videoChatSendBtn?.addEventListener(
  "click",
  sendChatMessage
);


videoChatInput?.addEventListener(
  "keydown",
  (
    event
  ) => {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();

      sendChatMessage();

    }

  }
);


/* =========================================================
   MOBILE MENU
   ========================================================= */

mobileMenuBtn?.addEventListener(
  "click",
  (
    event
  ) => {

    event.stopPropagation();

    mobileNav?.classList.toggle(
      "show"
    );

  }
);


/* =========================================================
   REWARDS MENU
   ========================================================= */

rewardsMenuBtn?.addEventListener(
  "click",
  (
    event
  ) => {

    event.stopPropagation();

    rewardsMenu?.classList.toggle(
      "show"
    );

    profileMenu?.classList.remove(
      "show"
    );

  }
);


/* =========================================================
   PROFILE MENU
   ========================================================= */

profileMenuBtn?.addEventListener(
  "click",
  (
    event
  ) => {

    event.stopPropagation();

    profileMenu?.classList.toggle(
      "show"
    );

    rewardsMenu?.classList.remove(
      "show"
    );

  }
);


/* =========================================================
   CLOSE DROPDOWNS
   ========================================================= */

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


/* =========================================================
   MOBILE NAV
   ========================================================= */

document
  .querySelectorAll(
    ".mobile-nav-link"
  )
  .forEach(
    (
      link
    ) => {

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


/* =========================================================
   LOGOUT
   ========================================================= */

dropdownLogoutBtn?.addEventListener(
  "click",
  async () => {

    try {

      await RandomVideoMatcher.endVideoCall();

    } catch (
      error
    ) {

      console.warn(
        "Video logout cleanup warning:",
        error
      );

    }


    await handleLogout();

  }
);


mobileLogoutBtn?.addEventListener(
  "click",
  async () => {

    try {

      await RandomVideoMatcher.endVideoCall();

    } catch (
      error
    ) {

      console.warn(
        "Video logout cleanup warning:",
        error
      );

    }


    await handleLogout();

  }
);


/* =========================================================
   RESIZE
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    if (
      window.innerWidth > 900
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

    try {

      RandomVideoMatcher.disconnect();

    } catch (
      error
    ) {

      console.warn(
        "Random Video cleanup warning:",
        error
      );

    }

  }
);