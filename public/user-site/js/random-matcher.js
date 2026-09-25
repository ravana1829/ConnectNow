/* =========================================================
   CONNECTNOW RANDOM CHAT MATCHER
   REAL SOCKET.IO MATCHING
   ========================================================= */

import { io } from "https://cdn.socket.io/4.8.3/socket.io.esm.min.js";

import {
  auth,
  db
} from "./firebase-config.js";

import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   SOCKET SERVER URL
   ========================================================= */

const SOCKET_SERVER_URL =
  window.CONNECTNOW_SOCKET_URL ||
  "https://connectnow-n26j.onrender.com";


/* =========================================================
   RANDOM MATCHER CLASS
   ========================================================= */

class RandomMatcher {

  constructor() {

    this.socket = null;

    this.socketReadyPromise = null;

    this.isRegistered = false;

    this.currentMatchId = null;

    this.matchedUserId = null;

    this.matchedUserName = null;

    this.matchedUser = null;

    this.isSearching = false;

    this.isActive = false;

    this.messageCallback = null;

    this.typingCallback = null;

    this.partnerDisconnectedCallback = null;

    this.matchCallback = null;

    this.serverErrorCallback = null;

    this.endCallback = null;

    this.pendingMatchResolve = null;

    this.pendingMatchReject = null;

    this.pendingNextResolve = null;

    this.pendingNextReject = null;

  }


  /* =======================================================
     GET CURRENT USER
  ======================================================= */

  getCurrentUser() {

    if (!auth.currentUser) {
      throw new Error("User is not authenticated.");
    }

    return auth.currentUser;

  }


  /* =======================================================
     GET CURRENT USER PROFILE
  ======================================================= */

  async getCurrentProfile() {

    const user = this.getCurrentUser();

    const profileRef =
      doc(
        db,
        "users",
        user.uid
      );

    const profileSnap =
      await getDoc(
        profileRef
      );

    if (!profileSnap.exists()) {
      throw new Error("User profile not found.");
    }

    return profileSnap.data();

  }


  /* =======================================================
     CREATE SOCKET
  ======================================================= */

  ensureSocket() {

    if (
      this.socket &&
      this.socket.connected &&
      this.isRegistered
    ) {

      return Promise.resolve(
        this.socket
      );

    }


    if (
      this.socketReadyPromise
    ) {

      return this.socketReadyPromise;

    }


    this.socketReadyPromise =
      new Promise(
        async (resolve, reject) => {

          try {

            const user =
              this.getCurrentUser();

            const profile =
              await this.getCurrentProfile();


            /* ---------------------------------------------
               CREATE SOCKET
            --------------------------------------------- */

            this.socket =
              io(
                SOCKET_SERVER_URL,
                {

                  transports: [
                    "websocket",
                    "polling"
                  ],

                  reconnection: true,

                  reconnectionAttempts:
                    10,

                  timeout:
                    10000

                }
              );


            /* ---------------------------------------------
               CONNECTED
            --------------------------------------------- */

            this.socket.on(
              "connect",
              () => {

                console.log(
                  "ConnectNow Random Chat Socket connected:",
                  this.socket.id
                );


                this.socket.emit(
                  "register",
                  {

                    userId:
                      user.uid,

                    displayName:
                      profile.displayName ||
                      user.displayName ||
                      "ConnectNow User",

                    gender:
                      profile.gender ||
                      "unknown"

                  }
                );

              }
            );


            /* ---------------------------------------------
               REGISTERED
            --------------------------------------------- */

            this.socket.once(
              "registered",
              (data = {}) => {

                console.log(
                  "Random Chat registered:",
                  data
                );


                this.isRegistered =
                  true;


                this.socketReadyPromise =
                  null;


                resolve(
                  this.socket
                );

              }
            );


            /* ---------------------------------------------
               RANDOM MATCH FOUND
            --------------------------------------------- */

            this.socket.on(
              "randomChatMatched",
              (data = {}) => {

                console.log(
                  "Random Chat matched:",
                  data
                );


                this.isSearching =
                  false;

                this.isActive =
                  true;


                this.currentMatchId =
                  data.roomId ||
                  null;


                const partner =
                  data.partner ||
                  {};


                this.matchedUserId =
                  partner.userId ||
                  null;


                this.matchedUserName =
                  partner.displayName ||
                  "Stranger";


                this.matchedUser =
                  {

                    id:
                      partner.userId ||
                      null,

                    uid:
                      partner.userId ||
                      null,

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


                if (
                  typeof this.matchCallback ===
                    "function"
                ) {

                  this.matchCallback(
                    this.matchedUser,
                    data
                  );

                }


                if (
                  this.pendingMatchResolve
                ) {

                  const resolveMatch =
                    this.pendingMatchResolve;


                  this.pendingMatchResolve =
                    null;

                  this.pendingMatchReject =
                    null;


                  resolveMatch(
                    this.matchedUser
                  );

                }

              }
            );


            /* ---------------------------------------------
               WAITING
            --------------------------------------------- */

            this.socket.on(
              "randomChatWaiting",
              () => {

                console.log(
                  "Random Chat waiting..."
                );


                this.isSearching =
                  true;


                if (
                  this.matchCallback
                ) {

                  this.matchCallback(
                    null,
                    {
                      waiting: true
                    }
                  );

                }

              }
            );


            /* ---------------------------------------------
               MESSAGE
            --------------------------------------------- */

            this.socket.on(
              "randomChatMessage",
              (data = {}) => {

                console.log(
                  "Random Chat message:",
                  data
                );


                if (
                  typeof this.messageCallback ===
                    "function"
                ) {

                  this.messageCallback(
                    {

                      message:
                        String(
                          data.message ||
                          ""
                        ),

                      userId:
                        data.userId ||
                        "",

                      displayName:
                        data.displayName ||
                        "Stranger",

                      socketId:
                        data.socketId ||
                        "",

                      timestamp:
                        data.timestamp ||
                        Date.now()

                    }
                  );

                }

              }
            );


            /* ---------------------------------------------
               TYPING
            --------------------------------------------- */

            this.socket.on(
              "randomChatTyping",
              (data = {}) => {

                if (
                  typeof this.typingCallback ===
                    "function"
                ) {

                  this.typingCallback(
                    {

                      userId:
                        data.userId ||
                        "",

                      typing:
                        Boolean(
                          data.typing
                        )

                    }
                  );

                }

              }
            );


            /* ---------------------------------------------
               PARTNER DISCONNECTED
            --------------------------------------------- */

            this.socket.on(
              "partnerDisconnected",
              (data = {}) => {

                console.log(
                  "Random Chat partner disconnected:",
                  data
                );


                this.clearMatchState();


                if (
                  typeof this.partnerDisconnectedCallback ===
                    "function"
                ) {

                  this.partnerDisconnectedCallback(
                    data
                  );

                }

              }
            );


            /* ---------------------------------------------
               CHAT ENDED
            --------------------------------------------- */

            this.socket.on(
              "randomChatEnded",
              () => {

                console.log(
                  "Random Chat ended."
                );


                this.clearMatchState();


                if (
                  typeof this.endCallback ===
                    "function"
                ) {

                  this.endCallback();

                }

              }
            );


            /* ---------------------------------------------
               READY FOR NEXT
            --------------------------------------------- */

            this.socket.on(
              "readyForNextRandomChat",
              () => {

                console.log(
                  "Ready for next random chat."
                );


                this.clearMatchState();


                if (
                  this.pendingNextResolve
                ) {

                  const resolveNext =
                    this.pendingNextResolve;


                  this.pendingNextResolve =
                    null;

                  this.pendingNextReject =
                    null;


                  resolveNext(
                    true
                  );

                }

              }
            );


            /* ---------------------------------------------
               ALREADY ACTIVE
            --------------------------------------------- */

            this.socket.on(
              "randomChatAlreadyActive",
              (data = {}) => {

                console.log(
                  "Random Chat already active:",
                  data
                );


                this.currentMatchId =
                  data.roomId ||
                  null;


                this.isSearching =
                  false;

                this.isActive =
                  Boolean(
                    this.currentMatchId
                  );

              }
            );


            /* ---------------------------------------------
               SERVER ERROR
            --------------------------------------------- */

            this.socket.on(
              "serverError",
              (data = {}) => {

                const message =
                  data.message ||
                  "Server error.";

                console.error(
                  "Random Chat server error:",
                  message
                );


                if (
                  this.pendingMatchReject
                ) {

                  const rejectMatch =
                    this.pendingMatchReject;


                  this.pendingMatchResolve =
                    null;

                  this.pendingMatchReject =
                    null;


                  rejectMatch(
                    new Error(
                      message
                    )
                  );

                }


                if (
                  typeof this.serverErrorCallback ===
                    "function"
                ) {

                  this.serverErrorCallback(
                    message
                  );

                }

              }
            );


            /* ---------------------------------------------
               SOCKET DISCONNECT
            --------------------------------------------- */

            this.socket.on(
              "disconnect",
              (reason) => {

                console.warn(
                  "Random Chat socket disconnected:",
                  reason
                );


                this.isRegistered =
                  false;

                this.isSearching =
                  false;

                this.isActive =
                  false;

              }
            );


            /* ---------------------------------------------
               CONNECTION ERROR
            --------------------------------------------- */

            this.socket.on(
              "connect_error",
              (error) => {

                console.error(
                  "Random Chat connection error:",
                  error
                );


                if (
                  !this.isRegistered
                ) {

                  this.socketReadyPromise =
                    null;

                  reject(
                    error
                  );

                }

              }
            );

          } catch (error) {

            this.socketReadyPromise =
              null;

            reject(
              error
            );

          }

        }
      );


    return this.socketReadyPromise;

  }


  /* =======================================================
     FIND RANDOM USER
     ======================================================= */

  async findRandomUser() {

    const socket =
      await this.ensureSocket();


    if (
      this.isActive &&
      this.currentMatchId
    ) {

      return this.matchedUser;

    }


    this.isSearching =
      true;


    return new Promise(
      (resolve, reject) => {

        this.pendingMatchResolve =
          resolve;

        this.pendingMatchReject =
          reject;


        try {

          socket.emit(
            "findRandomChat"
          );

        } catch (error) {

          this.pendingMatchResolve =
            null;

          this.pendingMatchReject =
            null;

          this.isSearching =
            false;

          reject(
            error
          );

        }

      }
    );

  }


  /* =======================================================
     START RANDOM CHAT
     ======================================================= */

  async startRandomChat(
    matchedUser = null
  ) {

    await this.ensureSocket();


    /*
      Matching already happened through
      findRandomChat.
    */

    if (
      matchedUser
    ) {

      this.matchedUser =
        matchedUser;

      this.matchedUserId =
        matchedUser.uid ||
        matchedUser.id ||
        null;

      this.matchedUserName =
        matchedUser.displayName ||
        "Stranger";

    }


    if (
      this.currentMatchId
    ) {

      this.isActive =
        true;

      return this.currentMatchId;

    }


    return null;

  }


  /* =======================================================
     SEND MESSAGE
     ======================================================= */

  async sendMessage(
    messageText
  ) {

    const text =
      String(
        messageText ||
        ""
      ).trim();


    if (
      !text ||
      !this.currentMatchId ||
      !this.socket ||
      !this.socket.connected
    ) {

      return false;

    }


    this.socket.emit(
      "randomChatMessage",
      {

        roomId:
          this.currentMatchId,

        message:
          text

      }
    );


    return true;

  }


  /* =======================================================
     START TYPING
     ======================================================= */

  setTyping(
    typing
  ) {

    if (
      !this.currentMatchId ||
      !this.socket ||
      !this.socket.connected
    ) {

      return;

    }


    this.socket.emit(
      "randomChatTyping",
      {

        typing:
          Boolean(typing),

        roomId:
          this.currentMatchId

      }
    );

  }


  /* =======================================================
     NEXT RANDOM CHAT
     ======================================================= */

  async nextRandomChat() {

    const socket =
      await this.ensureSocket();


    if (
      !this.isActive &&
      !this.currentMatchId
    ) {

      return true;

    }


    return new Promise(
      (resolve, reject) => {

        this.pendingNextResolve =
          resolve;

        this.pendingNextReject =
          reject;


        try {

          socket.emit(
            "nextRandomChat"
          );

        } catch (error) {

          this.pendingNextResolve =
            null;

          this.pendingNextReject =
            null;

          reject(
            error
          );

        }

      }
    );

  }


  /* =======================================================
     END RANDOM CHAT
     ======================================================= */

  async endRandomChat() {

    try {

      if (
        this.socket &&
        this.socket.connected
      ) {

        this.socket.emit(
          "endRandomChat"
        );

      }

    } catch (error) {

      console.error(
        "Error ending random chat:",
        error
      );

    }


    this.clearMatchState();

    return true;

  }


  /* =======================================================
     GET MATCH ID
     ======================================================= */

  getMatchId() {

    return this.currentMatchId;

  }


  /* =======================================================
     GET MATCHED USER ID
     ======================================================= */

  getMatchedUserId() {

    return this.matchedUserId;

  }


  /* =======================================================
     GET MATCHED USER
     ======================================================= */

  getMatchedUser() {

    return this.matchedUser;

  }


  /* =======================================================
     LISTEN FOR MESSAGES
     ======================================================= */

  getMessages(
    callback
  ) {

    this.messageCallback =
      typeof callback ===
        "function"
        ? callback
        : null;

  }


  /* =======================================================
     LISTEN FOR TYPING
     ======================================================= */

  onTyping(
    callback
  ) {

    this.typingCallback =
      typeof callback ===
        "function"
        ? callback
        : null;

  }


  /* =======================================================
     LISTEN FOR MATCHES
     ======================================================= */

  onMatch(
    callback
  ) {

    this.matchCallback =
      typeof callback ===
        "function"
        ? callback
        : null;

  }


  /* =======================================================
     PARTNER DISCONNECTED
     ======================================================= */

  onPartnerDisconnected(
    callback
  ) {

    this.partnerDisconnectedCallback =
      typeof callback ===
        "function"
        ? callback
        : null;

  }


  /* =======================================================
     SERVER ERROR
     ======================================================= */

  onServerError(
    callback
  ) {

    this.serverErrorCallback =
      typeof callback ===
        "function"
        ? callback
        : null;

  }


  /* =======================================================
     END CALLBACK
     ======================================================= */

  onEnd(
    callback
  ) {

    this.endCallback =
      typeof callback ===
        "function"
        ? callback
        : null;

  }


  /* =======================================================
     BLOCK USER
     ======================================================= */

  async blockUser(
    userId
  ) {

    const targetUserId =
      userId ||
      this.matchedUserId;


    if (!targetUserId) {

      return false;

    }


    try {

      const user =
        this.getCurrentUser();


      const userRef =
        doc(
          db,
          "users",
          user.uid
        );


      await updateDoc(
        userRef,
        {

          blockedUsers:
            arrayUnion(
              targetUserId
            )

        }
      );


      return true;

    } catch (error) {

      console.error(
        "Error blocking user:",
        error
      );


      return false;

    }

  }


  /* =======================================================
     REPORT USER
     ======================================================= */

  async reportUser(
    reason
  ) {

    const targetUserId =
      this.matchedUserId;


    if (!targetUserId) {

      return false;

    }


    const cleanReason =
      String(
        reason ||
        ""
      ).trim();


    if (!cleanReason) {

      return false;

    }


    try {

      const user =
        this.getCurrentUser();


      await addDoc(
        collection(
          db,
          "reports"
        ),
        {

          reportedBy:
            user.uid,

          reportedUser:
            targetUserId,

          reason:
            cleanReason,

          matchId:
            this.currentMatchId,

          timestamp:
            serverTimestamp(),

          status:
            "pending",

          type:
            "random-chat"

        }
      );


      return true;

    } catch (error) {

      console.error(
        "Error reporting user:",
        error
      );


      return false;

    }

  }


  /* =======================================================
     CLEAR LOCAL MATCH STATE
     ======================================================= */

  clearMatchState() {

    this.currentMatchId =
      null;

    this.matchedUserId =
      null;

    this.matchedUserName =
      null;

    this.matchedUser =
      null;

    this.isSearching =
      false;

    this.isActive =
      false;

  }


  /* =======================================================
     DISCONNECT SOCKET
     ======================================================= */

  disconnect() {

    if (this.socket) {

      this.socket.disconnect();

    }

    this.socket =
      null;

    this.socketReadyPromise =
      null;

    this.isRegistered =
      false;

    this.clearMatchState();

  }

}


/* =========================================================
   SINGLETON
   ========================================================= */

const randomMatcher =
  new RandomMatcher();


export default randomMatcher;