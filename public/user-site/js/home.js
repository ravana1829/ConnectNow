/* =========================================================
   CONNECTNOW HOME PAGE
   ========================================================= */

import {
  protectPage,
  onAuthReady,
  currentUser,
  currentProfile,
  handleLogout,
  formatNumber,
  setAvatar,
  getInitial
} from "./auth-helper.js";

/* =========================================================
   ELEMENTS
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

const randomChatBtn =
  document.getElementById(
    "randomChatBtn"
  );

const videoCallBtn =
  document.getElementById(
    "videoCallBtn"
  );

const groupChatBtn =
  document.getElementById(
    "groupChatBtn"
  );

const featureRandomChatBtn =
  document.getElementById(
    "featureRandomChatBtn"
  );

const featureVideoBtn =
  document.getElementById(
    "featureVideoBtn"
  );

const featureGroupBtn =
  document.getElementById(
    "featureGroupBtn"
  );

const featureProfileBtn =
  document.getElementById(
    "featureProfileBtn"
  );

const diamondBalance =
  document.getElementById(
    "diamondBalance"
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
   INITIALIZE PAGE
   ========================================================= */

protectPage().then(() => {
  onAuthReady((user, profile) => {
    updateUserUI();
  });
});

/* =========================================================
   UPDATE USER UI
   ========================================================= */

function updateUserUI() {

  if (!currentProfile) {
    return;
  }

  const name =
    currentProfile.displayName ||
    "ConnectNow User";

  const email =
    currentProfile.email ||
    "";

  if (navUserName) {
    navUserName.textContent =
      name;
  }

  if (dropdownUserName) {
    dropdownUserName.textContent =
      name;
  }

  if (dropdownUserEmail) {
    dropdownUserEmail.textContent =
      email ||
      "ConnectNow account";
  }

  if (diamondBalance) {
    diamondBalance.textContent =
      formatNumber(
        currentProfile.diamonds
      );
  }

  setAvatar(
    navUserAvatar,
    currentProfile.photoURL,
    name
  );

  setAvatar(
    dropdownUserAvatar,
    currentProfile.photoURL,
    name
  );

}



/* =========================================================
   MOBILE MENU
   ========================================================= */

mobileMenuBtn?.addEventListener(
  "click",
  (event) => {

    event.stopPropagation();

    mobileNav?.classList.toggle(
      "show"
    );

  }
);

/* =========================================================
   REWARDS DROPDOWN
   ========================================================= */

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

/* =========================================================
   PROFILE DROPDOWN
   ========================================================= */

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

/* =========================================================
   CLOSE MENUS WHEN CLICKING OUTSIDE
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
   PREVENT DROPDOWN CLOSE
   ========================================================= */

rewardsMenu?.addEventListener(
  "click",
  (event) => {

    event.stopPropagation();

  }
);

profileMenu?.addEventListener(
  "click",
  (event) => {

    event.stopPropagation();

  }
);

/* =========================================================
   MOBILE NAV CLOSE
   ========================================================= */

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

/* =========================================================
   RANDOM CHAT
   ========================================================= */

function openRandomChat() {

  window.location.href =
    "chat.html";

}

randomChatBtn?.addEventListener(
  "click",
  openRandomChat
);

featureRandomChatBtn?.addEventListener(
  "click",
  openRandomChat
);

/* =========================================================
   RANDOM VIDEO
   ========================================================= */

function openVideoCall() {

  window.location.href =
    "video-call.html";

}

videoCallBtn?.addEventListener(
  "click",
  openVideoCall
);

featureVideoBtn?.addEventListener(
  "click",
  openVideoCall
);

/* =========================================================
   GROUP CHAT
   ========================================================= */

function openGroupChat() {

  window.location.href =
    "group-chat.html";

}

groupChatBtn?.addEventListener(
  "click",
  openGroupChat
);

featureGroupBtn?.addEventListener(
  "click",
  openGroupChat
);

/* =========================================================
   PROFILE
   ========================================================= */

featureProfileBtn?.addEventListener(
  "click",
  () => {

    window.location.href =
      "profile.html";

  }
);



/* =========================================================
   LOGOUT BUTTONS
   ========================================================= */

dropdownLogoutBtn?.addEventListener(
  "click",
  handleLogout
);

mobileLogoutBtn?.addEventListener(
  "click",
  handleLogout
);

/* =========================================================
   CLOSE MOBILE MENU ON RESIZE
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