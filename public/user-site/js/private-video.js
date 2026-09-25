import { auth, db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { protectPage, currentUser, currentProfile, loadUserProfile } from "./auth-helper.js";

// Page Protection
protectPage();

// Configuration
const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

// State
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callId = null;
let recipientId = null;
let callStartTime = null;
let isCaller = false;
let callUnsubscribe = null;
let isMicOn = true;
let isCameraOn = true;

const elements = {
  localVideo: document.getElementById("localVideo"),
  remoteVideo: document.getElementById("remoteVideo"),
  toggleMicBtn: document.getElementById("toggleMicBtn"),
  toggleCameraBtn: document.getElementById("toggleCameraBtn"),
  shareScreenBtn: document.getElementById("shareScreenBtn"),
  endCallBtn: document.getElementById("endCallBtn"),
  recipientName: document.getElementById("recipientName"),
  callTimer: document.getElementById("callTimer"),
  connectionStatus: document.getElementById("connectionStatus"),
  remoteLabel: document.getElementById("remoteLabel"),
  connectionType: document.getElementById("connectionType"),
  resolution: document.getElementById("resolution"),
  bitrate: document.getElementById("bitrate"),
  waitingModal: document.getElementById("waitingModal"),
  notificationModal: document.getElementById("notificationModal"),
  cancelCallBtn: document.getElementById("cancelCallBtn"),
  acceptCallBtn: document.getElementById("acceptCallBtn"),
  rejectCallBtn: document.getElementById("rejectCallBtn"),
  callerName: document.getElementById("callerName"),
  callerAvatar: document.getElementById("callerAvatar"),
  waitingUserName: document.getElementById("waitingUserName"),
};

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserProfile(auth.currentUser);
  setupEventListeners();
  initializeCall();
});

function setupEventListeners() {
  elements.toggleMicBtn.addEventListener("click", toggleMicrophone);
  elements.toggleCameraBtn.addEventListener("click", toggleCamera);
  elements.shareScreenBtn.addEventListener("click", shareScreen);
  elements.endCallBtn.addEventListener("click", endCall);
  elements.cancelCallBtn.addEventListener("click", cancelCall);
  elements.acceptCallBtn.addEventListener("click", acceptCall);
  elements.rejectCallBtn.addEventListener("click", rejectCall);
}

async function initializeCall() {
  const params = new URLSearchParams(window.location.search);
  recipientId = params.get("friendId");

  if (!recipientId) {
    alert("No recipient specified");
    window.location.href = "/private-chat.html";
    return;
  }

  try {
    // Get recipient info
    const recipientDoc = await getDoc(doc(db, "users", recipientId));
    if (!recipientDoc.exists()) {
      alert("User not found");
      window.location.href = "/private-chat.html";
      return;
    }

    const recipientData = recipientDoc.data();
    elements.recipientName.textContent = recipientData.displayName;
    elements.waitingUserName.textContent = recipientData.displayName;
    elements.callerName.textContent = recipientData.displayName;
    elements.callerAvatar.src = recipientData.photoURL || "./assets/default-avatar.png";
    elements.remoteLabel.textContent = recipientData.displayName;

    // Initialize local stream
    await initializeLocalStream();

    // Create call ID
    callId = [currentUser.uid, recipientId].sort().join("_");
    isCaller = currentUser.uid < recipientId;

    if (isCaller) {
      // Start the call
      elements.waitingModal.classList.remove("hidden");
      await initiateCall();
    } else {
      // Wait for call
      listenForCall();
    }
  } catch (error) {
    console.error("Error initializing call:", error);
    alert("Failed to initialize call");
    window.location.href = "/private-chat.html";
  }
}

async function initializeLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: VIDEO_CONSTRAINTS,
    });

    elements.localVideo.srcObject = localStream;
    elements.localVideo.play();
  } catch (error) {
    console.error("Error accessing media devices:", error);
    alert("Unable to access camera/microphone. Please check permissions.");
    throw error;
  }
}

async function createPeerConnection() {
  try {
    peerConnection = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    // Add local stream tracks
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        elements.remoteVideo.srcObject = remoteStream;
        elements.remoteVideo.play();
      }
      remoteStream.addTrack(event.track);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await updateDoc(doc(db, "calls", callId), {
            [`iceCandidates.${Date.now()}`]: {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            },
          });
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    };

    // Monitor connection state
    peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", peerConnection.connectionState);
      updateConnectionStatus();
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peerConnection.iceConnectionState);
      updateConnectionStatus();
    };

    // Start stats monitoring
    monitorCallStats();
  } catch (error) {
    console.error("Error creating peer connection:", error);
    throw error;
  }
}

async function initiateCall() {
  try {
    await createPeerConnection();

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Save call to Firestore
    await setDoc(doc(db, "calls", callId), {
      caller: currentUser.uid,
      callerName: currentProfile.displayName,
      callerPhoto: currentProfile.photoURL,
      recipient: recipientId,
      status: "ringing",
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
      createdAt: serverTimestamp(),
      iceCandidates: {},
    });

    // Listen for answer
    listenForAnswer();
  } catch (error) {
    console.error("Error initiating call:", error);
    alert("Failed to initiate call");
    endCall();
  }
}

async function listenForCall() {
  try {
    const callDoc = doc(db, "calls", callId);

    callUnsubscribe = onSnapshot(callDoc, async (snapshot) => {
      if (!snapshot.exists()) return;

      const callData = snapshot.data();

      if (callData.status === "ringing" && !peerConnection) {
        // Show incoming call notification
        elements.notificationModal.classList.remove("hidden");
      }

      // Handle offer received
      if (callData.offer && !peerConnection) {
        handleCallReceived(callData);
      }

      // Handle answer received
      if (callData.answer && peerConnection && peerConnection.signalingState === "stable") {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(callData.answer)
          );
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }

      // Handle ICE candidates
      if (callData.iceCandidates) {
        const candidates = Object.values(callData.iceCandidates);
        for (const candidate of candidates) {
          if (peerConnection && candidate.candidate) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
              console.error("Error adding ICE candidate:", error);
            }
          }
        }
      }

      // Handle call ended
      if (callData.status === "ended") {
        if (callUnsubscribe) callUnsubscribe();
        endCall();
      }
    });
  } catch (error) {
    console.error("Error listening for call:", error);
  }
}

async function listenForAnswer() {
  try {
    const callDoc = doc(db, "calls", callId);

    callUnsubscribe = onSnapshot(callDoc, async (snapshot) => {
      if (!snapshot.exists()) return;

      const callData = snapshot.data();

      // Handle answer
      if (callData.answer && peerConnection) {
        if (peerConnection.signalingState === "have-local-offer") {
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(callData.answer)
            );
          } catch (error) {
            console.error("Error setting remote description:", error);
          }
        }
      }

      // Handle ICE candidates
      if (callData.iceCandidates) {
        const candidates = Object.values(callData.iceCandidates);
        for (const candidate of candidates) {
          if (peerConnection && candidate.candidate) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
              console.error("Error adding ICE candidate:", error);
            }
          }
        }
      }

      // Handle call rejected
      if (callData.status === "rejected") {
        alert("Call rejected");
        if (callUnsubscribe) callUnsubscribe();
        endCall();
      }

      // Handle call ended
      if (callData.status === "ended") {
        if (callUnsubscribe) callUnsubscribe();
        endCall();
      }
    });
  } catch (error) {
    console.error("Error listening for answer:", error);
  }
}

async function handleCallReceived(callData) {
  try {
    await createPeerConnection();

    // Set remote description
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(callData.offer)
    );

    // Create and send answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await updateDoc(doc(db, "calls", callId), {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
      status: "answered",
    });

    callStartTime = Date.now();
    startCallTimer();
    elements.notificationModal.classList.add("hidden");
    elements.connectionStatus.textContent = "Connected";
  } catch (error) {
    console.error("Error handling call received:", error);
  }
}

async function acceptCall() {
  try {
    elements.notificationModal.classList.add("hidden");
    
    const callDoc = doc(db, "calls", callId);
    const snapshot = await getDoc(callDoc);
    
    if (snapshot.exists()) {
      const callData = snapshot.data();
      await handleCallReceived(callData);
    }
  } catch (error) {
    console.error("Error accepting call:", error);
  }
}

async function rejectCall() {
  try {
    elements.notificationModal.classList.add("hidden");
    await updateDoc(doc(db, "calls", callId), {
      status: "rejected",
    });
    endCall();
  } catch (error) {
    console.error("Error rejecting call:", error);
  }
}

async function cancelCall() {
  try {
    elements.waitingModal.classList.add("hidden");
    await updateDoc(doc(db, "calls", callId), {
      status: "ended",
    });
    endCall();
  } catch (error) {
    console.error("Error canceling call:", error);
  }
}

function toggleMicrophone() {
  if (!localStream) return;

  isMicOn = !isMicOn;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = isMicOn;
  });

  elements.toggleMicBtn.classList.toggle("mic-on", isMicOn);
  elements.toggleMicBtn.classList.toggle("mic-off", !isMicOn);
}

function toggleCamera() {
  if (!localStream) return;

  isCameraOn = !isCameraOn;
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = isCameraOn;
  });

  elements.toggleCameraBtn.classList.toggle("camera-on", isCameraOn);
  elements.toggleCameraBtn.classList.toggle("camera-off", !isCameraOn);
}

async function shareScreen() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false,
    });

    const screenTrack = screenStream.getVideoTracks()[0];
    const sender = peerConnection
      .getSenders()
      .find((s) => s.track && s.track.kind === "video");

    if (sender) {
      await sender.replaceTrack(screenTrack);
      elements.shareScreenBtn.classList.add("active");

      screenTrack.onended = async () => {
        const videoTrack = localStream.getVideoTracks()[0];
        await sender.replaceTrack(videoTrack);
        elements.shareScreenBtn.classList.remove("active");
      };
    }
  } catch (error) {
    if (error.name !== "NotAllowedError") {
      console.error("Error sharing screen:", error);
    }
  }
}

async function endCall() {
  try {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
    }

    // Update call status
    if (callId) {
      await updateDoc(doc(db, "calls", callId), {
        status: "ended",
        endedAt: serverTimestamp(),
      });
    }

    // Unsubscribe from updates
    if (callUnsubscribe) {
      callUnsubscribe();
    }

    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = "/private-chat.html";
    }, 2000);
  } catch (error) {
    console.error("Error ending call:", error);
    window.location.href = "/private-chat.html";
  }
}

function updateConnectionStatus() {
  const state = peerConnection?.connectionState || "disconnected";
  const iceState = peerConnection?.iceConnectionState || "disconnected";

  let status = "Disconnected";
  if (state === "connected" || iceState === "connected") {
    status = "Connected";
    if (!callStartTime) {
      callStartTime = Date.now();
      startCallTimer();
    }
  } else if (state === "connecting" || iceState === "checking") {
    status = "Connecting...";
  } else if (state === "failed" || iceState === "failed") {
    status = "Connection Failed";
  }

  elements.connectionStatus.textContent = status;
}

function startCallTimer() {
  setInterval(() => {
    if (!callStartTime) return;
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    elements.callTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }, 1000);
}

async function monitorCallStats() {
  if (!peerConnection) return;

  setInterval(async () => {
    try {
      const stats = await peerConnection.getStats();
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.kind === "video") {
          const width = report.frameWidth;
          const height = report.frameHeight;
          if (width && height) {
            elements.resolution.textContent = `${width}x${height}`;
          }
        }

        if (report.type === "candidate-pair" && report.state === "succeeded") {
          const bitrate = Math.round(
            (report.availableOutgoingBitrate || 0) / 1024
          );
          elements.bitrate.textContent = `${bitrate} kbps`;
        }
      });
    } catch (error) {
      console.error("Error monitoring stats:", error);
    }
  }, 1000);
}
