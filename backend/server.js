require("dotenv").config();

const express =
  require("express");

const cors =
  require("cors");

const helmet =
  require("helmet");

const http =
  require("http");

const crypto =
  require("crypto");

const {
  Server
} = require("socket.io");


/* =========================================================
   APP
========================================================= */

const app =
  express();


const server =
  http.createServer(
    app
  );


/* =========================================================
   CONFIG
========================================================= */

const PORT =
  process.env.PORT ||
  5000;


const CLIENT_URL =
  process.env.CLIENT_URL ||
  "*";


/* =========================================================
   ADMIN
========================================================= */

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME ||
  "ravanan1829";


const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  "ravanan$1829";


const ADMIN_SESSION_MS =
  6 *
  60 *
  60 *
  1000;


const adminSessions =
  new Map();


/* =========================================================
   MEMORY
========================================================= */

const users =
  new Map();


const randomChatQueue =
  [];


const randomVideoQueue =
  [];


const randomChatRooms =
  new Map();


const videoRooms =
  new Map();


const groupRooms =
  new Map();


const socketGroupRoom =
  new Map();


const groupLiveRooms =
  new Map();


/*
  PRIVATE USER VIDEO

  streamer socket.id ->
  {
    hostSocketId,
    roomId,
    viewerSocketId,
    startedAt
  }
*/

const privateVideoRooms =
  new Map();


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  helmet(
    {
      crossOriginResourcePolicy:
        false
    }
  )
);


app.use(
  cors(
    {
      origin:
        CLIENT_URL === "*"
          ? true
          : CLIENT_URL,

      credentials:
        CLIENT_URL !== "*"
    }
  )
);


app.use(
  express.json()
);


app.use(
  express.urlencoded(
    {
      extended:
        true
    }
  )
);


/* =========================================================
   SOCKET.IO
========================================================= */

const io =
  new Server(
    server,
    {

      cors: {

        origin:
          CLIENT_URL === "*"
            ? true
            : CLIENT_URL,

        methods: [
          "GET",
          "POST"
        ],

        credentials:
          CLIENT_URL !== "*"

      },

      transports: [
        "websocket",
        "polling"
      ]

    }
  );


/* =========================================================
   HELPERS
========================================================= */

function createId(
  prefix = "room"
) {

  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    crypto
      .randomBytes(4)
      .toString("hex")
  );

}


function removeFromArray(
  array,
  value
) {

  const index =
    array.indexOf(
      value
    );


  if (
    index !== -1
  ) {

    array.splice(
      index,
      1
    );


    return true;

  }


  return false;

}


function getUser(
  socketId
) {

  return users.get(
    socketId
  );

}


function sendError(
  socket,
  message
) {

  socket.emit(
    "serverError",
    {
      message
    }
  );

}


/* =========================================================
   ADMIN HELPERS
========================================================= */

function safeCompare(
  a,
  b
) {

  const hashA =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        String(a),
        "utf8"
      )
      .digest();


  const hashB =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        String(b),
        "utf8"
      )
      .digest();


  return crypto.timingSafeEqual(
    hashA,
    hashB
  );

}


function createAdminToken() {

  return crypto
    .randomBytes(
      32
    )
    .toString(
      "hex"
    );

}


function isValidAdminToken(
  token
) {

  if (
    !token ||
    typeof token !==
      "string"
  ) {

    return false;

  }


  const session =
    adminSessions.get(
      token
    );


  if (!session)
    return false;


  if (
    Date.now() >
    session.expiresAt
  ) {

    adminSessions.delete(
      token
    );


    return false;

  }


  return true;

}


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.json(
      {
        success:
          true,

        service:
          "ConnectNow Server",

        status:
          "online",

        time:
          new Date()
            .toISOString()
      }
    );

  }
);


app.get(
  "/health",
  (req, res) => {

    res.json(
      {
        success:
          true,

        status:
          "healthy"
      }
    );

  }
);


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  (req, res) => {

    const username =
      String(
        req.body?.username ||
        ""
      ).trim();


    const password =
      String(
        req.body?.password ||
        ""
      );


    if (
      !username ||
      !password
    ) {

      return res
        .status(400)
        .json(
          {
            success:
              false,

            message:
              "Username and password are required."
          }
        );

    }


    const validUsername =
      safeCompare(
        username,
        ADMIN_USERNAME
      );


    const validPassword =
      safeCompare(
        password,
        ADMIN_PASSWORD
      );


    if (
      !validUsername ||
      !validPassword
    ) {

      return res
        .status(401)
        .json(
          {
            success:
              false,

            message:
              "Invalid admin username or password."
          }
        );

    }


    const token =
      createAdminToken();


    adminSessions.set(
      token,
      {

        username:
          ADMIN_USERNAME,

        createdAt:
          Date.now(),

        expiresAt:
          Date.now() +
          ADMIN_SESSION_MS

      }
    );


    return res.json(
      {

        success:
          true,

        token,

        expiresIn:
          ADMIN_SESSION_MS

      }
    );

  }
);


/* =========================================================
   ADMIN LOGOUT
========================================================= */

app.post(
  "/api/admin/logout",
  (req, res) => {

    const token =
      req.body?.token;


    if (token) {

      adminSessions.delete(
        token
      );

    }


    res.json(
      {
        success:
          true
      }
    );

  }
);


/* =========================================================
   ONLINE USERS
========================================================= */

app.get(
  "/api/online-users",
  (req, res) => {

    const list =
      [];


    for (
      const user
      of users.values()
    ) {

      list.push(
        {

          socketId:
            user.socketId,

          userId:
            user.userId,

          displayName:
            user.displayName,

          gender:
            user.gender,

          online:
            user.online

        }
      );

    }


    res.json(
      {

        success:
          true,

        count:
          list.length,

        users:
          list

      }
    );

  }
);


/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
  "connection",
  (socket) => {

    console.log(
      "Socket connected:",
      socket.id
    );


    /* =====================================================
       REGISTER
    ====================================================== */

    socket.on(
      "register",
      (data = {}) => {

        const userId =
          data.userId ||
          data.uid ||
          socket.id;


        const displayName =
          data.displayName ||
          data.username ||
          "ConnectNow User";


        const gender =
          data.gender ||
          "unknown";


        users.set(
          socket.id,
          {

            socketId:
              socket.id,

            userId,

            displayName,

            gender,

            roomId:
              null,

            online:
              true

          }
        );


        socket.userId =
          userId;


        socket.displayName =
          displayName;


        socket.emit(
          "registered",
          {

            success:
              true,

            socketId:
              socket.id,

            userId,

            displayName

          }
        );


        io.emit(
          "userOnline",
          {

            socketId:
              socket.id,

            userId,

            displayName,

            gender

          }
        );

      }
    );


    /* =====================================================
       RANDOM CHAT
    ====================================================== */

    socket.on(
      "findRandomChat",
      () => {

        const user =
          getUser(
            socket.id
          );


        if (!user) {

          sendError(
            socket,
            "Please register before starting random chat."
          );


          return;

        }


        if (user.roomId) {

          socket.emit(
            "randomChatAlreadyActive",
            {

              roomId:
                user.roomId

            }
          );


          return;

        }


        removeFromArray(
          randomChatQueue,
          socket.id
        );


        let partnerSocketId =
          null;


        while (
          randomChatQueue.length >
          0
        ) {

          const candidate =
            randomChatQueue.shift();


          if (
            candidate !==
              socket.id &&
            users.has(
              candidate
            )
          ) {

            partnerSocketId =
              candidate;


            break;

          }

        }


        if (
          !partnerSocketId
        ) {

          randomChatQueue.push(
            socket.id
          );


          socket.emit(
            "randomChatWaiting"
          );


          return;

        }


        const roomId =
          createId(
            "random_chat"
          );


        const partner =
          getUser(
            partnerSocketId
          );


        user.roomId =
          roomId;


        partner.roomId =
          roomId;


        randomChatRooms.set(
          roomId,
          {

            roomId,

            users: [
              socket.id,
              partnerSocketId
            ]

          }
        );


        socket.join(
          roomId
        );


        io.sockets.sockets
          .get(
            partnerSocketId
          )
          ?.join(
            roomId
          );


        socket.emit(
          "randomChatMatched",
          {

            roomId,

            partner: {

              socketId:
                partnerSocketId,

              userId:
                partner.userId,

              displayName:
                partner.displayName,

              gender:
                partner.gender

            }

          }
        );


        io.to(
          partnerSocketId
        ).emit(
          "randomChatMatched",
          {

            roomId,

            partner: {

              socketId:
                socket.id,

              userId:
                user.userId,

              displayName:
                user.displayName,

              gender:
                user.gender

            }

          }
        );

      }
    );


    /* RANDOM CHAT MESSAGE */

    socket.on(
      "randomChatMessage",
      (data = {}) => {

        const user =
          getUser(
            socket.id
          );


        if (!user)
          return;


        const roomId =
          data.roomId ||
          user.roomId;


        if (!roomId)
          return;


        const message =
          String(
            data.message ||
            ""
          ).trim();


        if (!message)
          return;


        io.to(
          roomId
        ).emit(
          "randomChatMessage",
          {

            message,

            userId:
              user.userId,

            displayName:
              user.displayName,

            socketId:
              socket.id,

            timestamp:
              Date.now()

          }
        );

      }
    );


    /* LEGACY MESSAGE */

    socket.on(
      "sendMessage",
      (data = {}) => {

        const user =
          getUser(
            socket.id
          );


        if (!user)
          return;


        const roomId =
          data.roomId ||
          user.roomId;


        if (!roomId)
          return;


        const message =
          String(
            data.message ||
            ""
          ).trim();


        if (!message)
          return;


        io.to(
          roomId
        ).emit(
          "receiveMessage",
          {

            message,

            userId:
              user.userId,

            displayName:
              user.displayName,

            socketId:
              socket.id,

            timestamp:
              Date.now()

          }
        );

      }
    );


    /* NEXT */

    socket.on(
      "nextRandomChat",
      () => {

        leaveRandomChat(
          socket
        );


        setTimeout(
          () => {

            if (
              users.has(
                socket.id
              )
            ) {

              socket.emit(
                "readyForNextRandomChat"
              );

            }

          },
          100
        );

      }
    );


    socket.on(
      "next",
      () => {

        leaveRandomChat(
          socket
        );


        setTimeout(
          () => {

            if (
              users.has(
                socket.id
              )
            ) {

              socket.emit(
                "readyForNextRandomChat"
              );

            }

          },
          100
        );

      }
    );


    socket.on(
      "endRandomChat",
      () => {

        leaveRandomChat(
          socket
        );


        socket.emit(
          "randomChatEnded"
        );

      }
    );


    socket.on(
      "randomChatTyping",
      (data = {}) => {

        const user =
          getUser(
            socket.id
          );


        if (
          !user ||
          !user.roomId
        )
          return;


        socket
          .to(
            user.roomId
          )
          .emit(
            "randomChatTyping",
            {

              userId:
                user.userId,

              typing:
                Boolean(
                  data.typing
                )

            }
          );

      }
    );


    /* =====================================================
       RANDOM VIDEO
    ====================================================== */

    /*
      Start / continue random video matching.
      Each connected socket may only be in one random
      video room at a time.
    */
    function startRandomVideoSearch() {

      const user =
        getUser(
          socket.id
        );


      if (!user) {

        sendError(
          socket,
          "Please register before starting video call."
        );

        return;

      }


      /* Already matched / active */
      if (user.roomId) {

        socket.emit(
          "videoAlreadyActive",
          {
            roomId:
              user.roomId
          }
        );

        return;

      }


      /*
        Never keep the same socket twice in the queue.
      */
      removeFromArray(
        randomVideoQueue,
        socket.id
      );


      let partnerSocketId =
        null;


      /*
        Remove stale / unusable queue entries until we find
        a real user who is connected and not already occupied.
      */
      while (
        randomVideoQueue.length > 0
      ) {

        const candidateSocketId =
          randomVideoQueue.shift();


        if (
          candidateSocketId ===
          socket.id
        ) {

          continue;

        }


        const candidate =
          getUser(
            candidateSocketId
          );


        const candidateSocket =
          io.sockets.sockets.get(
            candidateSocketId
          );


        if (
          !candidate ||
          !candidateSocket ||
          candidate.roomId ||
          candidate.userId ===
            user.userId
        ) {

          continue;

        }


        partnerSocketId =
          candidateSocketId;


        break;

      }


      /* -----------------------------------------------------
         NO PARTNER YET
      ----------------------------------------------------- */

      if (!partnerSocketId) {

        randomVideoQueue.push(
          socket.id
        );


        socket.emit(
          "randomVideoWaiting",
          {
            message:
              "Waiting for a random video-call partner..."
          }
        );


        return;

      }


      const partner =
        getUser(
          partnerSocketId
        );


      const partnerSocket =
        io.sockets.sockets.get(
          partnerSocketId
        );


      if (
        !partner ||
        !partnerSocket ||
        partner.roomId
      ) {

        return startRandomVideoSearch();

      }


      /* -----------------------------------------------------
         CREATE VIDEO ROOM
      ----------------------------------------------------- */

      const roomId =
        createId(
          "video"
        );


      user.roomId =
        roomId;


      partner.roomId =
        roomId;


      videoRooms.set(
        roomId,
        {

          roomId,

          users: [
            socket.id,
            partnerSocketId
          ],

          createdAt:
            Date.now()

        }
      );


      socket.join(
        roomId
      );


      partnerSocket.join(
        roomId
      );


      /* -----------------------------------------------------
         INITIATOR
      ----------------------------------------------------- */

      socket.emit(
        "videoMatched",
        {

          roomId,

          initiator:
            true,

          partner: {

            socketId:
              partnerSocketId,

            userId:
              partner.userId,

            displayName:
              partner.displayName,

            gender:
              partner.gender

          }

        }
      );


      /* -----------------------------------------------------
         SECOND USER
      ----------------------------------------------------- */

      partnerSocket.emit(
        "videoMatched",
        {

          roomId,

          initiator:
            false,

          partner: {

            socketId:
              socket.id,

            userId:
              user.userId,

            displayName:
              user.displayName,

            gender:
              user.gender

          }

        }
      );


      console.log(
        "Random video matched:",
        {

          roomId,

          user1:
            user.userId,

          user2:
            partner.userId

        }
      );

    }


    /* -------------------------------------------------------
       FIND RANDOM VIDEO
    ------------------------------------------------------- */

    socket.on(
      "findRandomVideo",
      () => {

        try {

          startRandomVideoSearch();

        } catch (
          error
        ) {

          console.error(
            "findRandomVideo error:",
            error
          );


          sendError(
            socket,
            "Unable to start random video search."
          );

        }

      }
    );


    /* =====================================================
       WEBRTC SIGNALING
    ====================================================== */

    /* -------------------------------------------------------
       OFFER
    ------------------------------------------------------- */

    socket.on(
      "video-offer",
      (data = {}) => {

        const user =
          getUser(
            socket.id
          );


        if (
          !user ||
          !user.roomId ||
          !data.offer
        ) {

          return;

        }


        const room =
          videoRooms.get(
            user.roomId
          );


        if (
          !room ||
          !room.users.includes(
            socket.id
          )
        ) {

          return;

        }


        socket
          .to(
            user.roomId
          )
          .emit(
            "video-offer",
            {

              roomId:
                user.roomId,

              offer:
                data.offer,

              from:
                socket.id

            }
          );

      }
    );


    /* -------------------------------------------------------
       ANSWER
    ------------------------------------------------------- */

    socket.on(
      "video-answer",
      (data = {}) => {

        const user =
          getUser(
            socket.id
          );


        if (
          !user ||
          !user.roomId ||
          !data.answer
        ) {

          return;

        }


        const room =
          videoRooms.get(
            user.roomId
          );


        if (
          !room ||
          !room.users.includes(
            socket.id
          )
        ) {

          return;

        }


        socket
          .to(
            user.roomId
          )
          .emit(
            "video-answer",
            {

              roomId:
                user.roomId,

              answer:
                data.answer,

              from:
                socket.id

            }
          );

      }
    );


    /* -------------------------------------------------------
       ICE CANDIDATE
    ------------------------------------------------------- */

    socket.on(
      "video-ice-candidate",
      (data = {}) => {

        const user =
          getUser(
            socket.id
          );


        if (
          !user ||
          !user.roomId ||
          !data.candidate
        ) {

          return;

        }


        const room =
          videoRooms.get(
            user.roomId
          );


        if (
          !room ||
          !room.users.includes(
            socket.id
          )
        ) {

          return;

        }


        socket
          .to(
            user.roomId
          )
          .emit(
            "video-ice-candidate",
            {

              roomId:
                user.roomId,

              candidate:
                data.candidate,

              from:
                socket.id

            }
          );

      }
    );


    /* =====================================================
       VIDEO CHAT MESSAGE
    ====================================================== */

    socket.on(
      "videoChatMessage",
      (data = {}) => {

        const user =
          getUser(
            socket.id
          );


        if (
          !user ||
          !user.roomId
        ) {

          return;

        }


        const room =
          videoRooms.get(
            user.roomId
          );


        if (
          !room ||
          !room.users.includes(
            socket.id
          )
        ) {

          return;

        }


        const message =
          String(
            data.message ||
            ""
          ).trim();


        if (
          !message ||
          message.length > 5000
        ) {

          return;

        }


        socket
          .to(
            user.roomId
          )
          .emit(
            "videoChatMessage",
            {

              message,

              userId:
                user.userId,

              displayName:
                user.displayName,

              timestamp:
                Date.now()

            }
          );

      }
    );


    /* =====================================================
       END VIDEO CALL
    ====================================================== */

    socket.on(
      "endVideoCall",
      () => {

        removeFromArray(
          randomVideoQueue,
          socket.id
        );


        const user =
          getUser(
            socket.id
          );


        if (
          !user ||
          !user.roomId
        ) {

          return;

        }


        const roomId =
          user.roomId;


        socket
          .to(
            roomId
          )
          .emit(
            "partnerVideoEnded",
            {

              message:
                "The other person ended the video call.",

              autoSearch:
                false

            }
          );


        clearVideoRoom(
          roomId
        );

      }
    );


    /* =====================================================
       NEXT RANDOM VIDEO
    ====================================================== */

    socket.on(
      "nextVideo",
      () => {

        const user =
          getUser(
            socket.id
          );


        if (!user) {

          return;

        }


        /*
          Remove the user from waiting queue
          before moving to the next person.
        */
        removeFromArray(
          randomVideoQueue,
          socket.id
        );


        const oldRoom =
          user.roomId;


        /* -------------------------------------------------
           CLOSE OLD ROOM
        ------------------------------------------------- */

        if (
          oldRoom
        ) {

          socket
            .to(
              oldRoom
            )
            .emit(
              "partnerVideoEnded",
              {

                message:
                  "Your partner moved to the next person.",

                autoSearch:
                  false

              }
            );


          clearVideoRoom(
            oldRoom
          );

        }


        /*
          Tell frontend that the old call has been cleared.
        */
        socket.emit(
          "readyForNextVideo"
        );


        /*
          Start a fresh search after the room cleanup.
        */
        setTimeout(
          () => {

            if (
              !users.has(
                socket.id
              )
            ) {

              return;

            }


            const currentUser =
              getUser(
                socket.id
              );


            if (
              !currentUser ||
              currentUser.roomId
            ) {

              return;

            }


            try {

              startRandomVideoSearch();

            } catch (
              error
            ) {

              console.error(
                "Next random video error:",
                error
              );


              sendError(
                socket,
                "Unable to find the next random person."
              );

            }

          },
          100
        );

      }
    );


    /* =====================================================
       GROUP JOIN
    ====================================================== */

    socket.on(
      "joinGroupChat",
      (data = {}) => {

        const roomId =
          data.roomId ||
          data.groupId ||
          "connectnow-community";


        joinGroup(
          socket,
          roomId
        );

      }
    );


    socket.on(
      "groupChatJoined",
      (data = {}) => {

        const roomId =
          data.roomId ||
          data.groupId ||
          "connectnow-community";


        joinGroup(
          socket,
          roomId
        );

      }
    );


    /* =====================================================
       GROUP MESSAGE
    ====================================================== */

    socket.on(
      "sendGroupMessage",
      (data = {}) => {

        const roomId =
          data.roomId ||
          socketGroupRoom.get(
            socket.id
          );


        if (!roomId) {

          sendError(
            socket,
            "You are not inside a group."
          );


          return;

        }


        const user =
          getUser(
            socket.id
          );


        const message =
          String(
            data.message ??
            data.text ??
            ""
          ).trim();


        if (!message)
          return;


        const payload = {

          id:
            createId(
              "msg"
            ),

          roomId,

          userId:
            data.userId ||
            user?.userId ||
            socket.id,

          displayName:
            data.displayName ||
            user?.displayName ||
            "ConnectNow User",

          message,

          timestamp:
            Date.now()

        };


        io.to(
          roomId
        ).emit(
          "receiveGroupMessage",
          payload
        );

      }
    );


    /* GROUP TYPING */

    socket.on(
      "groupTyping",
      (data = {}) => {

        const roomId =
          data.roomId ||
          socketGroupRoom.get(
            socket.id
          );


        if (!roomId)
          return;


        const user =
          getUser(
            socket.id
          );


        socket
          .to(
            roomId
          )
          .emit(
            "groupTyping",
            {

              userId:
                user?.userId ||
                socket.id,

              displayName:
                user?.displayName ||
                "User",

              typing:
                Boolean(
                  data.typing
                )

            }
          );

      }
    );


    /* =====================================================
       ADMIN GROUP LIVE
    ====================================================== */

    socket.on(
      "startGroupLive",
      (data = {}) => {

        const roomId =
          data.roomId ||
          socketGroupRoom.get(
            socket.id
          );


        if (!roomId) {

          sendError(
            socket,
            "Join a group before starting live."
          );


          return;

        }


        if (
          !isValidAdminToken(
            data.adminToken
          )
        ) {

          socket.emit(
            "adminRequired"
          );


          return;

        }


        groupLiveRooms.set(
          roomId,
          {

            roomId,

            hostSocketId:
              socket.id,

            hostName:
              data.hostName ||
              socket.displayName ||
              "Live Host",

            startedAt:
              Date.now()

          }
        );


        io.to(
          roomId
        ).emit(
          "groupLiveStarted",
          {

            roomId,

            hostSocketId:
              socket.id,

            hostName:
              data.hostName ||
              socket.displayName ||
              "Live Host"

          }
        );

      }
    );


    socket.on(
      "groupLiveViewer",
      (data = {}) => {

        const roomId =
          data.roomId ||
          socketGroupRoom.get(
            socket.id
          );


        if (!roomId)
          return;


        const live =
          groupLiveRooms.get(
            roomId
          );


        if (!live)
          return;


        io.to(
          live.hostSocketId
        ).emit(
          "groupLiveViewerJoined",
          {

            roomId,

            viewerSocketId:
              socket.id

          }
        );

      }
    );


    socket.on(
      "groupLiveOffer",
      (data = {}) => {

        if (
          !data.targetSocketId
        )
          return;


        io.to(
          data.targetSocketId
        ).emit(
          "groupLiveOffer",
          {

            roomId:
              data.roomId,

            fromSocketId:
              socket.id,

            offer:
              data.offer

          }
        );

      }
    );


    socket.on(
      "groupLiveAnswer",
      (data = {}) => {

        if (
          !data.targetSocketId
        )
          return;


        io.to(
          data.targetSocketId
        ).emit(
          "groupLiveAnswer",
          {

            roomId:
              data.roomId,

            fromSocketId:
              socket.id,

            answer:
              data.answer

          }
        );

      }
    );


    socket.on(
      "groupLiveIce",
      (data = {}) => {

        if (
          !data.targetSocketId
        )
          return;


        io.to(
          data.targetSocketId
        ).emit(
          "groupLiveIce",
          {

            roomId:
              data.roomId,

            fromSocketId:
              socket.id,

            candidate:
              data.candidate

          }
        );

      }
    );


    socket.on(
      "stopGroupLive",
      (data = {}) => {

        const roomId =
          data.roomId ||
          socketGroupRoom.get(
            socket.id
          );


        if (
          !isValidAdminToken(
            data.adminToken
          )
        ) {

          socket.emit(
            "adminRequired"
          );


          return;

        }


        const live =
          groupLiveRooms.get(
            roomId
          );


        if (!live)
          return;


        if (
          live.hostSocketId !==
          socket.id
        )
          return;


        groupLiveRooms.delete(
          roomId
        );


        io.to(
          roomId
        ).emit(
          "groupLiveStopped",
          {
            roomId
          }
        );

      }
    );


    /* =====================================================
       PRIVATE USER VIDEO
    ====================================================== */

    /*
      Current user starts his/her own private live.
    */

    socket.on(
      "startPrivateVideo",
      (data = {}) => {

        const roomId =
          data.roomId ||
          socketGroupRoom.get(
            socket.id
          );


        if (!roomId) {

          sendError(
            socket,
            "Join a group first."
          );


          return;

        }


        if (
          privateVideoRooms.has(
            socket.id
          )
        ) {

          return;

        }


        privateVideoRooms.set(
          socket.id,
          {

            hostSocketId:
              socket.id,

            roomId,

            viewerSocketId:
              null,

            startedAt:
              Date.now()

          }
        );


        io.to(
          roomId
        ).emit(
          "privateVideoStarted",
          {

            roomId,

            hostSocketId:
              socket.id,

            hostUserId:
              getUser(
                socket.id
              )?.userId,

            hostName:
              getUser(
                socket.id
              )?.displayName ||
              "User"

          }
        );


        sendGroupMemberUpdate(
          roomId
        );


        console.log(
          "Private video started:",
          socket.id
        );

      }
    );


    /*
      Viewer requests one private live user.
    */

    socket.on(
      "requestPrivateVideo",
      (data = {}) => {

        const roomId =
          data.roomId ||
          socketGroupRoom.get(
            socket.id
          );


        const targetSocketId =
          data.targetSocketId;


        if (
          !roomId ||
          !targetSocketId
        ) {

          return;

        }


        const targetRoom =
          socketGroupRoom.get(
            targetSocketId
          );


        if (
          targetRoom !==
          roomId
        ) {

          sendError(
            socket,
            "User is not in this group."
          );


          return;

        }


        const privateRoom =
          privateVideoRooms.get(
            targetSocketId
          );


        if (!privateRoom) {

          sendError(
            socket,
            "Private video is no longer live."
          );


          sendGroupMemberUpdate(
            roomId
          );


          return;

        }


        /*
          One-to-one private viewer.
        */

        if (
          privateRoom.viewerSocketId &&
          privateRoom.viewerSocketId !==
            socket.id
        ) {

          sendError(
            socket,
            "That private video is busy."
          );


          return;

        }


        privateRoom.viewerSocketId =
          socket.id;


        io.to(
          targetSocketId
        ).emit(
          "privateVideoViewerJoined",
          {

            roomId,

            viewerSocketId:
              socket.id

          }
        );


        socket.emit(
          "privateVideoConnecting",
          {

            roomId,

            hostSocketId:
              targetSocketId,

            hostName:
              getUser(
                targetSocketId
              )?.displayName ||
              "User"

          }
        );

      }
    );


    /*
      Private offer
    */

    socket.on(
      "privateVideoOffer",
      (data = {}) => {

        if (
          !data.targetSocketId
        ) {

          return;

        }


        io.to(
          data.targetSocketId
        ).emit(
          "privateVideoOffer",
          {

            fromSocketId:
              socket.id,

            offer:
              data.offer

          }
        );

      }
    );


    /*
      Private answer
    */

    socket.on(
      "privateVideoAnswer",
      (data = {}) => {

        if (
          !data.targetSocketId
        ) {

          return;

        }


        io.to(
          data.targetSocketId
        ).emit(
          "privateVideoAnswer",
          {

            fromSocketId:
              socket.id,

            answer:
              data.answer

          }
        );

      }
    );


    /*
      Private ICE
    */

    socket.on(
      "privateVideoIce",
      (data = {}) => {

        if (
          !data.targetSocketId
        ) {

          return;

        }


        io.to(
          data.targetSocketId
        ).emit(
          "privateVideoIce",
          {

            fromSocketId:
              socket.id,

            candidate:
              data.candidate

          }
        );

      }
    );


    /*
      Viewer closes private video.
      Host remains live.
    */

    socket.on(
      "endPrivateVideo",
      (data = {}) => {

        const targetSocketId =
          data.targetSocketId;


        if (!targetSocketId)
          return;


        const room =
          privateVideoRooms.get(
            targetSocketId
          );


        if (
          room &&
          room.viewerSocketId ===
            socket.id
        ) {

          room.viewerSocketId =
            null;


          io.to(
            targetSocketId
          ).emit(
            "privateVideoViewerLeft"
          );

        }

      }
    );


    /*
      Host stops private live.
    */

    socket.on(
      "stopPrivateVideo",
      (data = {}) => {

        const room =
          privateVideoRooms.get(
            socket.id
          );


        if (!room)
          return;


        privateVideoRooms.delete(
          socket.id
        );


        io.to(
          room.roomId
        ).emit(
          "privateVideoStopped",
          {

            roomId:
              room.roomId,

            hostSocketId:
              socket.id

          }
        );


        if (
          room.viewerSocketId
        ) {

          io.to(
            room.viewerSocketId
          ).emit(
            "privateVideoEndedForViewer"
          );

        }


        sendGroupMemberUpdate(
          room.roomId
        );

      }
    );


    /* =====================================================
       LEAVE
    ====================================================== */

    socket.on(
      "leaveGroup",
      () => {

        handleGroupLeave(
          socket
        );

      }
    );


    socket.on(
      "leaveGroupChat",
      () => {

        handleGroupLeave(
          socket
        );

      }
    );


    /* =====================================================
       DISCONNECT
    ====================================================== */

    socket.on(
      "disconnect",
      (reason) => {

        console.log(
          "Socket disconnected:",
          socket.id,
          reason
        );


        removeFromArray(
          randomChatQueue,
          socket.id
        );


        removeFromArray(
          randomVideoQueue,
          socket.id
        );


        leaveRandomChat(
          socket,
          true
        );


        const user =
          getUser(
            socket.id
          );


        if (
          user &&
          user.roomId
        ) {

          socket
            .to(
              user.roomId
            )
            .emit(
              "partnerDisconnected"
            );


          clearVideoRoom(
            user.roomId
          );

        }


        /* PRIVATE VIDEO HOST */

        const privateRoom =
          privateVideoRooms.get(
            socket.id
          );


        if (privateRoom) {

          privateVideoRooms.delete(
            socket.id
          );


          io.to(
            privateRoom.roomId
          ).emit(
            "privateVideoStopped",
            {

              roomId:
                privateRoom.roomId,

              hostSocketId:
                socket.id

            }
          );


          if (
            privateRoom.viewerSocketId
          ) {

            io.to(
              privateRoom.viewerSocketId
            ).emit(
              "privateVideoEndedForViewer"
            );

          }


          sendGroupMemberUpdate(
            privateRoom.roomId
          );

        }


        /* PRIVATE VIDEO VIEWER */

        for (
          const room
          of privateVideoRooms.values()
        ) {

          if (
            room.viewerSocketId ===
              socket.id
          ) {

            room.viewerSocketId =
              null;


            io.to(
              room.hostSocketId
            ).emit(
              "privateVideoViewerLeft"
            );

          }

        }


        /* GROUP */

        const groupRoom =
          socketGroupRoom.get(
            socket.id
          );


        if (groupRoom) {

          const live =
            groupLiveRooms.get(
              groupRoom
            );


          if (
            live &&
            live.hostSocketId ===
              socket.id
          ) {

            groupLiveRooms.delete(
              groupRoom
            );


            socket
              .to(
                groupRoom
              )
              .emit(
                "groupLiveHostLeft",
                {

                  roomId:
                    groupRoom

                }
              );

          }


          handleGroupLeave(
            socket,
            true
          );

        }


        const disconnectedUser =
          users.get(
            socket.id
          );


        if (
          disconnectedUser
        ) {

          io.emit(
            "userOffline",
            {

              socketId:
                socket.id,

              userId:
                disconnectedUser.userId

            }
          );

        }


        users.delete(
          socket.id
        );

      }
    );

  }
);


/* =========================================================
   RANDOM CHAT CLEANUP
========================================================= */

function leaveRandomChat(
  socket,
  disconnected = false
) {

  const user =
    getUser(
      socket.id
    );


  if (!user)
    return;


  const roomId =
    user.roomId;


  if (!roomId) {

    removeFromArray(
      randomChatQueue,
      socket.id
    );


    return;

  }


  const room =
    randomChatRooms.get(
      roomId
    );


  if (room) {

    for (
      const memberId
      of room.users
    ) {

      if (
        memberId !==
        socket.id
      ) {

        io.to(
          memberId
        ).emit(
          "partnerDisconnected",
          {

            reason:
              disconnected
                ? "disconnect"
                : "left"

          }
        );


        const partner =
          getUser(
            memberId
          );


        if (partner) {

          partner.roomId =
            null;

        }

      }

    }

  }


  socket.leave(
    roomId
  );


  randomChatRooms.delete(
    roomId
  );


  user.roomId =
    null;

}


/* =========================================================
   VIDEO CLEANUP
========================================================= */

function clearVideoRoom(
  roomId
) {

  if (!roomId)
    return;


  const room =
    videoRooms.get(
      roomId
    );


  if (!room)
    return;


  for (
    const memberId
    of room.users
  ) {

    const member =
      getUser(
        memberId
      );


    if (member) {

      member.roomId =
        null;


      const memberSocket =
        io.sockets.sockets.get(
          memberId
        );


      if (
        memberSocket
      ) {

        memberSocket.leave(
          roomId
        );

      }

    }

  }


  videoRooms.delete(
    roomId
  );

}


/* =========================================================
   GROUP JOIN
========================================================= */

function joinGroup(
  socket,
  roomId
) {

  if (!roomId)
    return;


  const oldRoom =
    socketGroupRoom.get(
      socket.id
    );


  if (
    oldRoom &&
    oldRoom !== roomId
  ) {

    handleGroupLeave(
      socket
    );

  }


  socket.join(
    roomId
  );


  socketGroupRoom.set(
    socket.id,
    roomId
  );


  if (
    !groupRooms.has(
      roomId
    )
  ) {

    groupRooms.set(
      roomId,
      new Set()
    );

  }


  groupRooms
    .get(
      roomId
    )
    .add(
      socket.id
    );


  const members =
    getGroupMembers(
      roomId
    );


  socket.emit(
    "groupJoined",
    {
      roomId,
      members
    }
  );


  socket.emit(
    "groupChatJoined",
    {
      roomId,
      members
    }
  );


  socket
    .to(
      roomId
    )
    .emit(
      "userJoinedGroup",
      {

        socketId:
          socket.id,

        userId:
          getUser(
            socket.id
          )?.userId ||
          socket.id,

        displayName:
          getUser(
            socket.id
          )?.displayName ||
          "ConnectNow User"

      }
    );


  sendGroupMemberUpdate(
    roomId
  );


  const live =
    groupLiveRooms.get(
      roomId
    );


  if (
    live &&
    live.hostSocketId !==
      socket.id
  ) {

    socket.emit(
      "groupLiveStarted",
      {

        roomId,

        hostSocketId:
          live.hostSocketId,

        hostName:
          live.hostName

      }
    );

  }


  /* PRIVATE LIVE STATUS */

  for (
    const privateRoom
    of privateVideoRooms.values()
  ) {

    if (
      privateRoom.roomId ===
        roomId
    ) {

      socket.emit(
        "privateVideoStarted",
        {

          roomId,

          hostSocketId:
            privateRoom.hostSocketId,

          hostName:
            getUser(
              privateRoom.hostSocketId
            )?.displayName ||
            "User"

        }
      );

    }

  }

}


/* =========================================================
   MEMBER UPDATE
========================================================= */

function sendGroupMemberUpdate(
  roomId
) {

  io.to(
    roomId
  ).emit(
    "groupMembersUpdated",
    {

      roomId,

      members:
        getGroupMembers(
          roomId
        )

    }
  );

}


/* =========================================================
   GROUP LEAVE
========================================================= */

function handleGroupLeave(
  socket,
  disconnected = false
) {

  const roomId =
    socketGroupRoom.get(
      socket.id
    );


  if (!roomId)
    return;


  const members =
    groupRooms.get(
      roomId
    );


  if (members) {

    members.delete(
      socket.id
    );


    if (
      members.size ===
      0
    ) {

      groupRooms.delete(
        roomId
      );

    } else {

      socket
        .to(
          roomId
        )
        .emit(
          "userLeftGroup",
          {

            socketId:
              socket.id,

            userId:
              getUser(
                socket.id
              )?.userId ||
              socket.id,

            displayName:
              getUser(
                socket.id
              )?.displayName ||
              "User"

          }
        );


      sendGroupMemberUpdate(
        roomId
      );

    }

  }


  socket.leave(
    roomId
  );


  socketGroupRoom.delete(
    socket.id
  );


  if (!disconnected) {

    socket.emit(
      "groupLeft",
      {
        roomId
      }
    );

  }

}


/* =========================================================
   GROUP MEMBERS
========================================================= */

function getGroupMembers(
  roomId
) {

  const members =
    groupRooms.get(
      roomId
    );


  if (!members)
    return [];


  const result =
    [];


  for (
    const socketId
    of members
  ) {

    const user =
      getUser(
        socketId
      );


    if (!user)
      continue;


    result.push(
      {

        socketId,

        userId:
          user.userId,

        displayName:
          user.displayName,

        gender:
          user.gender,

        online:
          user.online,

        privateLive:
          privateVideoRooms.has(
            socketId
          )

      }
    );

  }


  return result;

}


/* =========================================================
   EXPIRED ADMIN SESSIONS
========================================================= */

setInterval(
  () => {

    const now =
      Date.now();


    for (
      const [
        token,
        session
      ]
      of adminSessions
    ) {

      if (
        now >
        session.expiresAt
      ) {

        adminSessions.delete(
          token
        );

      }

    }

  },
  10 *
  60 *
  1000
);


/* =========================================================
   SERVER START
========================================================= */

server.listen(
  PORT,
  () => {

    console.log("");

    console.log(
      "======================================"
    );

    console.log(
      "       CONNECTNOW SERVER STARTED"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server: http://localhost:${PORT}`
    );

    console.log(
      "Group Chat: ENABLED"
    );

    console.log(
      "Admin Public Live: ENABLED"
    );

    console.log(
      "Private User Video: ENABLED"
    );

    console.log(
      "Random Chat: ENABLED"
    );

    console.log(
      "Random Video: ENABLED"
    );

    console.log(
      "Status: ONLINE"
    );

    console.log(
      "======================================"
    );

    console.log("");

  }
);


/* =========================================================
   PROCESS SAFETY
========================================================= */

process.on(
  "uncaughtException",
  (error) => {

    console.error(
      "Uncaught Exception:",
      error
    );

  }
);


process.on(
  "unhandledRejection",
  (error) => {

    console.error(
      "Unhandled Rejection:",
      error
    );

  }
);