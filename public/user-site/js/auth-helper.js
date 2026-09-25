/* =========================================================
   CONNECTNOW AUTH HELPER
   Authentication + Profile + Wallet Utilities
   ========================================================= */

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase-config.js";


/* =========================================================
   GLOBAL STATE
   ========================================================= */

export let currentUser = null;

export let currentProfile = null;

let authCheckComplete = false;

const authListeners = [];


/* =========================================================
   AUTH READY
   ========================================================= */

export function onAuthReady(
  callback
) {

  if (
    typeof callback !== "function"
  ) {

    return;

  }


  if (
    authCheckComplete
  ) {

    callback(
      currentUser,
      currentProfile
    );

    return;

  }


  authListeners.push(
    callback
  );

}


/* =========================================================
   NOTIFY AUTH LISTENERS
   ========================================================= */

export function notifyAuthListeners() {

  for (
    const callback
    of authListeners
  ) {

    try {

      callback(
        currentUser,
        currentProfile
      );

    } catch (
      error
    ) {

      console.error(
        "Auth listener error:",
        error
      );

    }

  }


  authCheckComplete =
    true;

}


/* =========================================================
   PROTECT PAGE
   ========================================================= */

export function protectPage() {

  return new Promise(
    (resolve) => {

      let resolved =
        false;


      const unsubscribe =
        onAuthStateChanged(
          auth,
          async (
            user
          ) => {

            if (
              resolved
            ) {

              return;

            }


            if (
              !user
            ) {

              resolved =
                true;


              try {

                unsubscribe();

              } catch (
                error
              ) {

                console.warn(
                  "Auth unsubscribe warning:",
                  error
                );

              }


              window.location.href =
                "login.html";


              resolve(
                false
              );


              return;

            }


            currentUser =
              user;


            try {

              await loadUserProfile(
                user
              );

            } catch (
              error
            ) {

              console.error(
                "Profile load error:",
                error
              );

            }


            notifyAuthListeners();


            resolved =
              true;


            try {

              unsubscribe();

            } catch (
              error
            ) {

              console.warn(
                "Auth unsubscribe warning:",
                error
              );

            }


            resolve(
              true
            );

          }
        );

    }
  );

}


/* =========================================================
   LOAD USER PROFILE
   ========================================================= */

export async function loadUserProfile(
  user
) {

  if (
    !user
  ) {

    return null;

  }


  let firestoreData =
    {};


  try {

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


    if (
      profileSnap.exists()
    ) {

      firestoreData =
        profileSnap.data();

    } else {

      /*
        Create only when the profile does not exist.
      */

      const newProfile =
        {

          userId:
            user.uid,

          displayName:
            user.displayName ||
            user.email?.split("@")[0] ||
            "ConnectNow User",

          email:
            user.email ||
            "",

          photoURL:
            user.photoURL ||
            "",

          diamonds:
            0,

          randomChatFreeCount:
            10,

          randomVideoChatFreeCount:
            10,

          createdAt:
            serverTimestamp(),

          lastLogin:
            serverTimestamp()

        };


      try {

        await setDoc(
          profileRef,
          newProfile
        );


        firestoreData =
          newProfile;

      } catch (
        error
      ) {

        console.error(
          "Error creating user profile:",
          error
        );


        /*
          Continue with local fallback profile.
        */
        firestoreData =
          {

            ...newProfile,

            createdAt:
              null,

            lastLogin:
              null

          };

      }

    }

  } catch (
    error
  ) {

    console.error(
      "Error loading user profile:",
      error
    );


    /*
      Safe local fallback.
    */
    firestoreData =
      {};

  }


  /*
    IMPORTANT:
    Use ?? instead of || for free counts.
    So when count = 0, it stays 0.
  */

  const displayName =
    firestoreData.displayName ??
    user.displayName ??
    user.email?.split("@")[0] ??
    "ConnectNow User";


  const email =
    firestoreData.email ??
    user.email ??
    "";


  const photoURL =
    firestoreData.photoURL ??
    user.photoURL ??
    "";


  const diamonds =
    Number(
      firestoreData.diamonds ?? 0
    );


  const randomChatFreeCount =
    Number(
      firestoreData.randomChatFreeCount ?? 10
    );


  const randomVideoChatFreeCount =
    Number(
      firestoreData.randomVideoChatFreeCount ?? 10
    );


  currentProfile =
    {

      userId:
        user.uid,

      displayName:
        displayName,

      email:
        email,

      photoURL:
        photoURL,

      diamonds:
        Math.max(
          0,
          diamonds
        ),

      randomChatFreeCount:
        Math.max(
          0,
          randomChatFreeCount
        ),

      randomVideoChatFreeCount:
        Math.max(
          0,
          randomVideoChatFreeCount
        ),

      age:
        firestoreData.age ??
        null,

      gender:
        firestoreData.gender ??
        "unknown",

      bio:
        firestoreData.bio ??
        "",

      status:
        firestoreData.status ??
        "offline",

      onlineStatus:
        firestoreData.onlineStatus ??
        "offline"

    };


  return currentProfile;

}


/* =========================================================
   REFRESH CURRENT PROFILE
   ========================================================= */

export async function refreshCurrentProfile() {

  if (
    !currentUser
  ) {

    return null;

  }


  try {

    return await loadUserProfile(
      currentUser
    );

  } catch (
    error
  ) {

    console.error(
      "Profile refresh error:",
      error
    );


    return currentProfile;

  }

}


/* =========================================================
   UPDATE USER PROFILE
   ========================================================= */

export async function updateUserProfile(
  updates
) {

  if (
    !currentUser ||
    !currentProfile ||
    !updates ||
    typeof updates !== "object"
  ) {

    return false;

  }


  try {

    const profileRef =
      doc(
        db,
        "users",
        currentUser.uid
      );


    /*
      Do not overwrite protected identity fields
      accidentally from helper callers.
    */
    const safeUpdates =
      {
        ...updates
      };


    delete safeUpdates.userId;

    delete safeUpdates.isAdmin;

    delete safeUpdates.banned;

    delete safeUpdates.banReason;

    delete safeUpdates.adminSince;

    delete safeUpdates.deleted;

    delete safeUpdates.deletedAt;


    safeUpdates.lastUpdated =
      serverTimestamp();


    await updateDoc(
      profileRef,
      safeUpdates
    );


    /*
      Update local state immediately.
    */
    Object.assign(
      currentProfile,
      updates
    );


    return true;

  } catch (
    error
  ) {

    console.error(
      "Error updating profile:",
      error
    );


    return false;

  }

}


/* =========================================================
   DECREMENT RANDOM CHAT FREE COUNT
   ========================================================= */

export async function decrementFreeRandomChat() {

  if (
    !currentUser ||
    !currentProfile
  ) {

    return false;

  }


  const currentCount =
    Number(
      currentProfile.randomChatFreeCount ?? 0
    );


  if (
    currentCount <= 0
  ) {

    return false;

  }


  const newCount =
    Math.max(
      0,
      currentCount - 1
    );


  return await updateUserProfile(
    {

      randomChatFreeCount:
        newCount

    }
  );

}


/* =========================================================
   DECREMENT RANDOM VIDEO FREE COUNT
   ========================================================= */

export async function decrementFreeRandomVideoChat() {

  if (
    !currentUser ||
    !currentProfile
  ) {

    return false;

  }


  const currentCount =
    Number(
      currentProfile.randomVideoChatFreeCount ?? 0
    );


  if (
    currentCount <= 0
  ) {

    return false;

  }


  const newCount =
    Math.max(
      0,
      currentCount - 1
    );


  return await updateUserProfile(
    {

      randomVideoChatFreeCount:
        newCount

    }
  );

}


/* =========================================================
   ADD DIAMONDS
   ========================================================= */

export async function addDiamonds(
  amount
) {

  if (
    !currentUser ||
    !currentProfile
  ) {

    return false;

  }


  const value =
    Number(
      amount
    );


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {

    return false;

  }


  const currentBalance =
    Number(
      currentProfile.diamonds ?? 0
    );


  const newBalance =
    currentBalance +
    value;


  return await updateUserProfile(
    {

      diamonds:
        newBalance

    }
  );

}


/* =========================================================
   SPEND DIAMONDS
   ========================================================= */

export async function spendDiamonds(
  amount
) {

  if (
    !currentUser ||
    !currentProfile
  ) {

    return false;

  }


  const value =
    Number(
      amount
    );


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {

    return false;

  }


  const currentBalance =
    Number(
      currentProfile.diamonds ?? 0
    );


  if (
    currentBalance < value
  ) {

    return false;

  }


  const newBalance =
    currentBalance -
    value;


  return await updateUserProfile(
    {

      diamonds:
        newBalance

    }
  );

}


/* =========================================================
   SET ONLINE STATUS
   ========================================================= */

export async function setOnlineStatus(
  status
) {

  if (
    !currentUser
  ) {

    return false;

  }


  const safeStatus =
    status === "online"
      ? "online"
      : "offline";


  return await updateUserProfile(
    {

      status:
        safeStatus,

      onlineStatus:
        safeStatus

    }
  );

}


/* =========================================================
   LOGOUT
   ========================================================= */

export async function handleLogout() {

  try {

    await signOut(
      auth
    );


    currentUser =
      null;

    currentProfile =
      null;


    authCheckComplete =
      false;


    window.location.href =
      "login.html";


    return true;

  } catch (
    error
  ) {

    console.error(
      "Logout error:",
      error
    );


    return false;

  }

}


/* =========================================================
   FORMAT NUMBER
   ========================================================= */

export function formatNumber(
  number
) {

  const value =
    Number(
      number ?? 0
    );


  return value.toLocaleString(
    "en-IN"
  );

}


/* =========================================================
   GET INITIAL
   ========================================================= */

export function getInitial(
  name
) {

  const text =
    String(
      name ||
      "C"
    ).trim();


  return (
    text.charAt(0) ||
    "C"
  ).toUpperCase();

}


/* =========================================================
   SET AVATAR
   ========================================================= */

export function setAvatar(
  element,
  photoURL,
  name
) {

  if (
    !element
  ) {

    return;

  }


  element.innerHTML =
    "";


  const cleanPhotoURL =
    String(
      photoURL ||
      ""
    ).trim();


  if (
    cleanPhotoURL
  ) {

    const image =
      document.createElement(
        "img"
      );


    image.src =
      cleanPhotoURL;


    image.alt =
      name ||
      "User";


    image.loading =
      "lazy";


    image.onerror =
      () => {

        element.innerHTML =
          "";


        element.textContent =
          getInitial(
            name
          );

      };


    element.appendChild(
      image
    );


    return;

  }


  element.textContent =
    getInitial(
      name
    );

}


/* =========================================================
   GET CURRENT USER ID
   ========================================================= */

export function getCurrentUserId() {

  return (
    currentUser?.uid ||
    null
  );

}


/* =========================================================
   GET CURRENT PROFILE COPY
   ========================================================= */

export function getCurrentProfile() {

  return currentProfile;

}