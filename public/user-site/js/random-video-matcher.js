/* =========================================================
   CONNECTNOW RANDOM VIDEO MATCHER
   REAL SOCKET.IO + WEBRTC
   UI IS KEPT IN video-call.html
   ========================================================= */

import { auth, db } from "./firebase-config.js";

import {
  currentProfile,
  decrementFreeRandomVideoChat
} from "./auth-helper.js";

import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


class RandomVideoMatcher {

  constructor() {

    this.socket = null;
    this.socketReadyPromise = null;

    this.isRegistered = false;
    this.isSearching = false;
    this.isMatched = false;

    this.roomId = null;

    this.matchedUserId = null;
    this.matchedUser = null;

    this.isInitiator = false;

    this.peerConnection = null;

    this.localStream = null;
    this.remoteStream = null;

    this.remoteDescriptionSet = false;

    this.pendingIceCandidates = [];

    /* =====================================================
       FREE VIDEO CALL / TIMER
    ====================================================== */

    this.callTimer = null;

    this.callSecondsRemaining = 120;

    /*
      Prevent the same matched room from
      consuming the free count twice.
    */
    this.freeCallUsedForRoom = false;


    this.callbacks = {

      match: null,

      remoteStream: null,

      connectionState: null,

      partnerEnded: null,

      nextReady: null,

      serverError: null,

      mediaError: null,

      chatMessage: null

    };


    this.boundSocket = null;

  }


  /* =====================================================
     GET FIRESTORE PROFILE
  ====================================================== */

  async getProfile() {

    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "User is not authenticated."
      );
    }

    const snap = await getDoc(
      doc(
        db,
        "users",
        user.uid
      )
    );

    return snap.exists()
      ? snap.data()
      : {};

  }


  /* =====================================================
     SOCKET URL
  ====================================================== */

  getSocketUrl() {

    return (
      window.CONNECTNOW_SOCKET_URL ||
      "https://connectnow-n26j.onrender.com"
    );

  }


  /* =====================================================
     ENSURE SOCKET
  ====================================================== */

  async ensureSocket() {

    if (
      this.socket?.connected &&
      this.isRegistered
    ) {

      return this.socket;

    }


    if (this.socketReadyPromise) {

      return this.socketReadyPromise;

    }


    this.socketReadyPromise =
      new Promise(
        async (
          resolve,
          reject
        ) => {

          try {

            if (!auth.currentUser) {

              throw new Error(
                "Please login first."
              );

            }


            if (
              typeof window.io !==
              "function"
            ) {

              throw new Error(
                "Socket.IO client is not loaded."
              );

            }


            const profile =
              await this.getProfile();


            this.socket =
              window.io(
                this.getSocketUrl(),
                {

                  transports: [
                    "websocket",
                    "polling"
                  ],

                  reconnection: true,

                  reconnectionAttempts: 10,

                  timeout: 10000

                }
              );


            this.socket.once(
              "registered",
              (data = {}) => {

                this.isRegistered =
                  true;

                this.socketReadyPromise =
                  null;

                console.log(
                  "Random Video socket registered",
                  data
                );

                resolve(
                  this.socket
                );

              }
            );


            this.socket.on(
              "connect",
              () => {

                this.isRegistered =
                  false;

                console.log(
                  "Random Video socket connected",
                  this.socket.id
                );


                this.socket.emit(
                  "register",
                  {

                    userId:
                      auth.currentUser.uid,

                    uid:
                      auth.currentUser.uid,

                    displayName:
                      profile.displayName ||
                      auth.currentUser.displayName ||
                      "ConnectNow User",

                    gender:
                      profile.gender ||
                      "unknown"

                  }
                );

              }
            );


            this.bindSocketEvents();


            this.socket.on(
              "connect_error",
              (error) => {

                console.error(
                  "Random Video socket connection error",
                  error
                );


                if (
                  !this.isRegistered
                ) {

                  this.socketReadyPromise =
                    null;

                  reject(error);

                }

              }
            );


            this.socket.on(
              "disconnect",
              (reason) => {

                console.warn(
                  "Random Video socket disconnected",
                  reason
                );


                this.stopCallTimer();

                this.isRegistered =
                  false;

                this.isSearching =
                  false;

              }
            );


          } catch (error) {

            this.socketReadyPromise =
              null;

            reject(error);

          }

        }
      );


    return this.socketReadyPromise;

  }


  /* =====================================================
     SOCKET EVENTS
  ====================================================== */

  bindSocketEvents() {

    if (
      !this.socket ||
      this.boundSocket ===
        this.socket
    ) {

      return;

    }


    this.boundSocket =
      this.socket;


    /* ===================================================
       WAITING
    ==================================================== */

    this.socket.on(
      "randomVideoWaiting",
      () => {

        this.isSearching =
          true;

        this.isMatched =
          false;

        /*
          IMPORTANT:
          Waiting does NOT consume free call.
        */

        this.callbacks.match?.(
          null,
          {
            waiting: true
          }
        );

      }
    );


    /* ===================================================
       VIDEO ALREADY ACTIVE
    ==================================================== */

    this.socket.on(
      "videoAlreadyActive",
      (data = {}) => {

        this.roomId =
          data.roomId ||
          null;

        this.isMatched =
          Boolean(
            this.roomId
          );

        this.isSearching =
          false;

        this.callbacks.serverError?.(
          "A video call is already active."
        );

      }
    );


    /* ===================================================
       VIDEO MATCHED
    ==================================================== */

    this.socket.on(
      "videoMatched",
      async (data = {}) => {

        try {

          this.roomId =
            data.roomId ||
            null;

          this.isInitiator =
            Boolean(
              data.initiator
            );

          this.isSearching =
            false;

          this.isMatched =
            true;


          const partner =
            data.partner ||
            {};


          this.matchedUserId =
            partner.userId ||
            null;


          this.matchedUser = {

            userId:
              this.matchedUserId,

            displayName:
              partner.displayName ||
              "Stranger",

            gender:
              partner.gender ||
              "unknown",

            socketId:
              partner.socketId ||
              null

          };


          /* =============================================
             FREE VIDEO CALL CHECK
          ============================================== */

          if (
            !this.freeCallUsedForRoom
          ) {

            const freeCount =
              Number(
                currentProfile
                  ?.randomVideoChatFreeCount ??
                0
              );


            /*
              No free calls remaining.
              Do not continue the call.
            */

            if (
              freeCount <= 0
            ) {

              this.callbacks.serverError?.(
                "Your 10 free video calls are completed. Please use diamonds for the next call."
              );


              try {

                if (
                  this.socket?.connected
                ) {

                  this.socket.emit(
                    "endVideoCall"
                  );

                }

              } catch {}


              this.closePeerConnection();

              this.resetMatch();

              this.isSearching =
                false;

              return;

            }


            /*
              COUNT DECREASES HERE ONLY.

              This happens AFTER partner
              is actually matched.

              Waiting does not reduce count.
            */

            const deducted =
              await decrementFreeRandomVideoChat();


            if (!deducted) {

              this.callbacks.serverError?.(
                "Unable to use your free video call."
              );


              try {

                if (
                  this.socket?.connected
                ) {

                  this.socket.emit(
                    "endVideoCall"
                  );

                }

              } catch {}


              this.closePeerConnection();

              this.resetMatch();

              this.isSearching =
                false;

              return;

            }


            this.freeCallUsedForRoom =
              true;

          }


          /* =============================================
             START 2 MINUTE TIMER
          ============================================== */

          this.startCallTimer();


          /* =============================================
             CREATE WEBRTC CONNECTION
          ============================================== */

          await this.createPeerConnection();


          /* =============================================
             CREATE OFFER
          ============================================== */

          if (
            this.isInitiator
          ) {

            await this.createOffer();

          }


          /* =============================================
             CALLBACK TO VIDEO PAGE
          ============================================== */

          this.callbacks.match?.(
            this.matchedUser,
            {

              roomId:
                this.roomId,

              initiator:
                this.isInitiator

            }
          );


        } catch (error) {

          console.error(
            "Random Video match setup error",
            error
          );


          this.callbacks.serverError?.(
            "Unable to establish video connection."
          );

        }

      }
    );


    /* ===================================================
       VIDEO OFFER
    ==================================================== */

    this.socket.on(
      "video-offer",
      async (data = {}) => {

        try {

          if (
            !data.offer
          ) {

            return;

          }


          if (
            !this.peerConnection
          ) {

            await this.createPeerConnection();

          }


          await this.peerConnection
            .setRemoteDescription(
              new RTCSessionDescription(
                data.offer
              )
            );


          this.remoteDescriptionSet =
            true;


          await this.flushPendingIceCandidates();


          const answer =
            await this.peerConnection
              .createAnswer();


          await this.peerConnection
            .setLocalDescription(
              answer
            );


          this.socket.emit(
            "video-answer",
            {

              roomId:
                this.roomId,

              answer: {

                type:
                  answer.type,

                sdp:
                  answer.sdp

              }

            }
          );


        } catch (error) {

          console.error(
            "Random Video offer error",
            error
          );


          this.callbacks.serverError?.(
            "Video connection setup failed."
          );

        }

      }
    );


    /* ===================================================
       VIDEO ANSWER
    ==================================================== */

    this.socket.on(
      "video-answer",
      async (data = {}) => {

        try {

          if (
            !data.answer ||
            !this.peerConnection
          ) {

            return;

          }


          if (
            this.peerConnection
              .currentRemoteDescription
          ) {

            return;

          }


          await this.peerConnection
            .setRemoteDescription(
              new RTCSessionDescription(
                data.answer
              )
            );


          this.remoteDescriptionSet =
            true;


          await this.flushPendingIceCandidates();


        } catch (error) {

          console.error(
            "Random Video answer error",
            error
          );


          this.callbacks.serverError?.(
            "Video answer could not be applied."
          );

        }

      }
    );


    /* ===================================================
       ICE CANDIDATE
    ==================================================== */

    this.socket.on(
      "video-ice-candidate",
      async (data = {}) => {

        try {

          if (
            !data.candidate
          ) {

            return;

          }


          const candidate =
            new RTCIceCandidate(
              data.candidate
            );


          if (
            !this.peerConnection ||
            !this.remoteDescriptionSet
          ) {

            this.pendingIceCandidates
              .push(candidate);

            return;

          }


          await this.peerConnection
            .addIceCandidate(
              candidate
            );


        } catch (error) {

          console.warn(
            "Random Video ICE candidate error",
            error
          );

        }

      }
    );


    /* ===================================================
       VIDEO CHAT MESSAGE
    ==================================================== */

    this.socket.on(
      "videoChatMessage",
      (data = {}) => {

        this.callbacks.chatMessage?.(
          data
        );

      }
    );


    /* ===================================================
       PARTNER VIDEO ENDED
    ==================================================== */

    this.socket.on(
      "partnerVideoEnded",
      (data = {}) => {

        this.stopCallTimer();


        this.closePeerConnection();

        this.resetMatch();


        this.freeCallUsedForRoom =
          false;


        this.isSearching =
          false;


        this.callbacks.partnerEnded?.(
          data
        );

      }
    );


    /* ===================================================
       READY FOR NEXT VIDEO
    ==================================================== */

    this.socket.on(
      "readyForNextVideo",
      () => {

        this.stopCallTimer();


        this.closePeerConnection();

        this.resetMatch();


        this.freeCallUsedForRoom =
          false;


        this.isSearching =
          false;


        this.callbacks.nextReady?.();

      }
    );


    /* ===================================================
       SERVER ERROR
    ==================================================== */

    this.socket.on(
      "serverError",
      (data = {}) => {

        this.callbacks.serverError?.(
          data.message ||
          "Random video server error."
        );

      }
    );

  }


  /* =====================================================
     CAMERA + MICROPHONE
  ====================================================== */

  async getUserMedia() {

    if (
      this.localStream
    ) {

      return this.localStream;

    }


    try {

      if (
        !navigator
          .mediaDevices
          ?.getUserMedia
      ) {

        throw new Error(
          "Camera and microphone are not supported."
        );

      }


      this.localStream =
        await navigator
          .mediaDevices
          .getUserMedia({

            video: {

              width: {
                min: 1280,
                ideal: 1280,
                max: 1920
              },

              height: {
                min: 720,
                ideal: 720,
                max: 1080
              },

              aspectRatio: {
                ideal: 16 / 9
              },

              frameRate: {
                min: 24,
                ideal: 30,
                max: 30
              },

              facingMode:
                "user"

            },

            audio: {

              echoCancellation:
                true,

              noiseSuppression:
                true,

              autoGainControl:
                true,

              channelCount: {
                ideal: 2
              }

            }

          });


      return this.localStream;


    } catch (error) {

      console.error(
        "Camera/microphone error",
        error
      );


      this.callbacks.mediaError?.(
        error
      );


      throw error;

    }

  }


  /* =====================================================
     CREATE PEER CONNECTION
  ====================================================== */

  async createPeerConnection() {

    this.closePeerConnection();


    await this.getUserMedia();


    this.peerConnection =
      new RTCPeerConnection({

        iceServers: [

          {
            urls:
              "stun:stun.l.google.com:19302"
          },

          {
            urls:
              "stun:stun1.l.google.com:19302"
          },

          {
            urls:
              "stun:stun2.l.google.com:19302"
          }

        ],

        bundlePolicy:
          "max-bundle"

      });


    this.remoteStream =
      new MediaStream();


    /* ===================================================
       ADD LOCAL TRACKS + HD SETTINGS
    ==================================================== */

    for (
      const track
      of this.localStream.getTracks()
    ) {

      const sender =
        this.peerConnection.addTrack(
          track,
          this.localStream
        );


      if (
        track.kind ===
        "video"
      ) {

        try {

          const parameters =
            sender.getParameters();


          if (
            !parameters.encodings ||
            parameters.encodings.length ===
              0
          ) {

            parameters.encodings =
              [{}];

          }


          const encoding =
            parameters.encodings[0];


          encoding.maxBitrate =
            3000000;


          encoding.maxFramerate =
            30;


          encoding.scaleResolutionDownBy =
            1;


          await sender.setParameters(
            parameters
          );


        } catch (error) {

          console.warn(
            "HD video parameter warning:",
            error
          );

        }

      }

    }


    /* ===================================================
       REMOTE VIDEO TRACK
    ==================================================== */

    this.peerConnection
      .addEventListener(
        "track",
        (event) => {

          if (
            event.streams?.[0]
          ) {

            this.remoteStream =
              event.streams[0];

          } else {

            this.remoteStream
              .addTrack(
                event.track
              );

          }


          this.callbacks
            .remoteStream?.(
              this.remoteStream
            );

        }
      );


    /* ===================================================
       ICE CANDIDATE
    ==================================================== */

    this.peerConnection
      .addEventListener(
        "icecandidate",
        (event) => {

          if (
            !event.candidate ||
            !this.socket?.connected ||
            !this.roomId
          ) {

            return;

          }


          this.socket.emit(
            "video-ice-candidate",
            {

              roomId:
                this.roomId,

              candidate: {

                candidate:
                  event.candidate
                    .candidate,

                sdpMLineIndex:
                  event.candidate
                    .sdpMLineIndex,

                sdpMid:
                  event.candidate
                    .sdpMid

              }

            }
          );

        }
      );


    /* ===================================================
       CONNECTION STATE
    ==================================================== */

    this.peerConnection
      .addEventListener(
        "connectionstatechange",
        () => {

          this.callbacks
            .connectionState?.(

              this.peerConnection
                ?.connectionState ||
              "closed"

            );

        }
      );


    return this.peerConnection;

  }


  /* =====================================================
     CREATE OFFER
  ====================================================== */

  async createOffer() {

    if (
      !this.peerConnection ||
      !this.socket?.connected ||
      !this.roomId
    ) {

      return;

    }


    const offer =
      await this.peerConnection
        .createOffer({

          offerToReceiveAudio:
            true,

          offerToReceiveVideo:
            true

        });


    await this.peerConnection
      .setLocalDescription(
        offer
      );


    this.socket.emit(
      "video-offer",
      {

        roomId:
          this.roomId,

        offer: {

          type:
            offer.type,

          sdp:
            offer.sdp

        }

      }
    );

  }


  /* =====================================================
     FLUSH ICE CANDIDATES
  ====================================================== */

  async flushPendingIceCandidates() {

    if (
      !this.peerConnection ||
      !this.remoteDescriptionSet
    ) {

      return;

    }


    const candidates =
      [
        ...this.pendingIceCandidates
      ];


    this.pendingIceCandidates =
      [];


    for (
      const candidate
      of candidates
    ) {

      try {

        await this.peerConnection
          .addIceCandidate(
            candidate
          );

      } catch (error) {

        console.warn(
          "Queued ICE failed",
          error
        );

      }

    }

  }


  /* =====================================================
     START RANDOM VIDEO CALL
  ====================================================== */

  async startRandomVideoCall() {

    await this.ensureSocket();


    /*
      Check FREE count before searching.

      If 0, don't enter the queue.
    */

    const freeCount =
      Number(
        currentProfile
          ?.randomVideoChatFreeCount ??
        0
      );


    if (
      freeCount <= 0
    ) {

      this.callbacks.serverError?.(
        "Your 10 free video calls are completed. Please use diamonds for the next call."
      );

      return;

    }


    await this.getUserMedia();


    this.closePeerConnection();

    this.resetMatch();


    this.freeCallUsedForRoom =
      false;


    this.isSearching =
      true;


    /*
      IMPORTANT:
      Count is NOT reduced here.

      It is reduced only when
      videoMatched is received.
    */

    this.socket.emit(
      "findRandomVideo"
    );

  }


  /* =====================================================
     NEXT VIDEO
  ====================================================== */

  async nextVideo() {

    await this.ensureSocket();


    /*
      Check remaining free calls.
    */

    const freeCount =
      Number(
        currentProfile
          ?.randomVideoChatFreeCount ??
        0
      );


    if (
      freeCount <= 0
    ) {

      this.stopCallTimer();


      this.callbacks.serverError?.(
        "Your 10 free video calls are completed. Please use diamonds for the next call."
      );


      return;

    }


    this.stopCallTimer();


    this.closePeerConnection();

    this.resetMatch();


    /*
      New room = new free call.
    */

    this.freeCallUsedForRoom =
      false;


    this.isSearching =
      true;


    this.socket.emit(
      "nextVideo"
    );

  }


  /* =====================================================
     END VIDEO CALL
  ====================================================== */

  async endVideoCall() {

    this.stopCallTimer();


    try {

      if (
        this.socket?.connected
      ) {

        this.socket.emit(
          "endVideoCall"
        );

      }

    } catch (error) {

      console.warn(
        "End video call warning",
        error
      );

    }


    this.closePeerConnection();

    this.resetMatch();

    this.stopLocalStream();


    this.freeCallUsedForRoom =
      false;


    this.isSearching =
      false;

  }


  /* =====================================================
     SEND VIDEO CHAT MESSAGE
  ====================================================== */

  async sendChatMessage(
    message
  ) {

    const text =
      String(
        message || ""
      ).trim();


    if (
      !text ||
      !this.socket?.connected ||
      !this.roomId
    ) {

      return false;

    }


    this.socket.emit(
      "videoChatMessage",
      {

        roomId:
          this.roomId,

        message:
          text

      }
    );


    return true;

  }


  /* =====================================================
     REPORT USER
  ====================================================== */

  async reportUser(
    reason
  ) {

    if (
      !auth.currentUser ||
      !this.matchedUserId
    ) {

      return false;

    }


    try {

      await addDoc(
        collection(
          db,
          "reports"
        ),
        {

          reportedBy:
            auth.currentUser.uid,

          reportedUser:
            this.matchedUserId,

          reason:
            String(
              reason ||
              "No reason provided"
            ).trim() ||
            "No reason provided",

          type:
            "random-video",

          matchId:
            this.roomId ||
            null,

          status:
            "pending",

          timestamp:
            serverTimestamp()

        }
      );


      return true;


    } catch (error) {

      console.error(
        "Report save error",
        error
      );


      return false;

    }

  }


  /* =====================================================
     BLOCK USER
  ====================================================== */

  async blockUser() {

    if (
      !auth.currentUser ||
      !this.matchedUserId
    ) {

      return false;

    }


    try {

      await updateDoc(
        doc(
          db,
          "users",
          auth.currentUser.uid
        ),
        {

          blockedUsers:
            arrayUnion(
              this.matchedUserId
            )

        }
      );


      return true;


    } catch (error) {

      console.error(
        "Block save error",
        error
      );


      return false;

    }

  }


  /* =====================================================
     MUTE / UNMUTE
  ====================================================== */

  setMuted(
    muted
  ) {

    if (
      !this.localStream
    ) {

      return false;

    }


    this.localStream
      .getAudioTracks()
      .forEach(
        (track) => {

          track.enabled =
            !muted;

        }
      );


    return true;

  }


  /* =====================================================
     CAMERA ON / OFF
  ====================================================== */

  setCameraEnabled(
    enabled
  ) {

    if (
      !this.localStream
    ) {

      return false;

    }


    this.localStream
      .getVideoTracks()
      .forEach(
        (track) => {

          track.enabled =
            Boolean(
              enabled
            );

        }
      );


    return true;

  }


  /* =====================================================
     GETTERS
  ====================================================== */

  getLocalStream() {

    return this.localStream;

  }


  getRemoteStream() {

    return this.remoteStream;

  }


  getMatchedUser() {

    return this.matchedUser;

  }


  getRoomId() {

    return this.roomId;

  }


  /* =====================================================
     2 MINUTE CALL TIMER
  ====================================================== */

  startCallTimer() {

    /*
      Clear any previous timer.
    */

    this.stopCallTimer();


    /*
      Every matched call starts at 2 minutes.
    */

    this.callSecondsRemaining =
      120;


    /*
      Update UI immediately.
    */

    this.updateCallTimerDisplay();


    /*
      Start countdown.
    */

    this.callTimer =
      setInterval(
        () => {

          this.callSecondsRemaining--;


          this.updateCallTimerDisplay();


          /*
            When timer reaches zero,
            automatically end the call.
          */

          if (
            this.callSecondsRemaining <=
            0
          ) {

            this.stopCallTimer();


            this.endVideoCall();

          }

        },
        1000
      );

  }


  /* =====================================================
     STOP CALL TIMER
  ====================================================== */

  stopCallTimer() {

    if (
      this.callTimer
    ) {

      clearInterval(
        this.callTimer
      );

      this.callTimer =
        null;

    }


    this.callSecondsRemaining =
      120;


    /*
      Reset visible timer to 2:00
      if timer element exists.
    */

    this.updateCallTimerDisplay();

  }


  /* =====================================================
     UPDATE TIMER UI
  ====================================================== */

  updateCallTimerDisplay() {

    const timerElement =
      document.getElementById(
        "callTimer"
      );


    /*
      If video-call.html does not
      have #callTimer, nothing breaks.
    */

    if (
      !timerElement
    ) {

      return;

    }


    const minutes =
      Math.floor(
        this.callSecondsRemaining /
        60
      );


    const seconds =
      this.callSecondsRemaining %
      60;


    timerElement.textContent =
      `${minutes}:${String(
        seconds
      ).padStart(
        2,
        "0"
      )}`;

  }


  /* =====================================================
     CLOSE PEER CONNECTION
  ====================================================== */

  closePeerConnection() {

    this.pendingIceCandidates =
      [];

    this.remoteDescriptionSet =
      false;


    if (
      this.peerConnection
    ) {

      try {

        this.peerConnection.close();

      } catch {}

    }


    this.peerConnection =
      null;

    this.remoteStream =
      null;

  }


  /* =====================================================
     STOP LOCAL STREAM
  ====================================================== */

  stopLocalStream() {

    if (
      !this.localStream
    ) {

      return;

    }


    this.localStream
      .getTracks()
      .forEach(
        (track) => {

          track.stop();

        }
      );


    this.localStream =
      null;

  }


  /* =====================================================
     RESET MATCH
  ====================================================== */

  resetMatch() {

    this.roomId =
      null;

    this.matchedUserId =
      null;

    this.matchedUser =
      null;

    this.isInitiator =
      false;

    this.isMatched =
      false;

  }


  /* =====================================================
     CALLBACKS
  ====================================================== */

  onMatch(
    callback
  ) {

    this.callbacks.match =
      callback;

  }


  onRemoteStream(
    callback
  ) {

    this.callbacks.remoteStream =
      callback;

  }


  onConnectionState(
    callback
  ) {

    this.callbacks.connectionState =
      callback;

  }


  onPartnerEnded(
    callback
  ) {

    this.callbacks.partnerEnded =
      callback;

  }


  onNextReady(
    callback
  ) {

    this.callbacks.nextReady =
      callback;

  }


  onServerError(
    callback
  ) {

    this.callbacks.serverError =
      callback;

  }


  onMediaError(
    callback
  ) {

    this.callbacks.mediaError =
      callback;

  }


  onChatMessage(
    callback
  ) {

    this.callbacks.chatMessage =
      callback;

  }


  /* =====================================================
     DISCONNECT
  ====================================================== */

  disconnect() {

    /*
      Stop timer first.
    */

    this.stopCallTimer();


    try {

      if (
        this.socket?.connected
      ) {

        this.socket.emit(
          "endVideoCall"
        );

      }

    } catch {}


    this.closePeerConnection();

    this.stopLocalStream();

    this.resetMatch();


    this.freeCallUsedForRoom =
      false;


    this.isSearching =
      false;

    this.isRegistered =
      false;


    this.socket?.disconnect();

    this.socket =
      null;

    this.socketReadyPromise =
      null;

    this.boundSocket =
      null;

  }

}


/* =========================================================
   SINGLE RANDOM VIDEO MATCHER INSTANCE
   ========================================================= */

const randomVideoMatcher =
  new RandomVideoMatcher();


export default randomVideoMatcher;