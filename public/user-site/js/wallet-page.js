/* =========================================================
   CONNECTNOW WALLET PAGE
   ========================================================= */

import {
  protectPage,
  onAuthReady,
  currentProfile,
  handleLogout,
  formatNumber,
  setAvatar,
  getInitial
} from "./auth-helper.js";

/* =========================================================
   ELEMENTS
   ========================================================= */

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileNav = document.getElementById("mobileNav");
const rewardsMenuBtn = document.getElementById("rewardsMenuBtn");
const rewardsMenu = document.getElementById("rewardsMenu");
const profileMenuBtn = document.getElementById("profileMenuBtn");
const profileMenu = document.getElementById("profileMenu");
const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");
const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");

const navUserName = document.getElementById("navUserName");
const navUserAvatar = document.getElementById("navUserAvatar");
const dropdownUserName = document.getElementById("dropdownUserName");
const dropdownUserEmail = document.getElementById("dropdownUserEmail");
const dropdownUserAvatar = document.getElementById("dropdownUserAvatar");

const diamondBalance = document.getElementById("diamondBalance");
const freeRandomChatCount = document.getElementById("freeRandomChatCount");
const freeRandomVideoCount = document.getElementById("freeRandomVideoCount");
const buyDiamondsBtn = document.getElementById("buyDiamondsBtn");

/* =========================================================
   INITIALIZE PAGE
   ========================================================= */

protectPage().then(() => {
  onAuthReady((user, profile) => {
    updateUI();
  });
});

/* =========================================================
   UPDATE UI
   ========================================================= */

function updateUI() {
  const name = currentProfile.displayName || "ConnectNow User";
  const email = currentProfile.email || "ConnectNow account";

  // Update navigation
  if (navUserName) navUserName.textContent = name;
  if (dropdownUserName) dropdownUserName.textContent = name;
  if (dropdownUserEmail) dropdownUserEmail.textContent = email;

  // Update avatars
  setAvatar(navUserAvatar, currentProfile.photoURL, name);
  setAvatar(dropdownUserAvatar, currentProfile.photoURL, name);

  // Update wallet info
  if (diamondBalance) {
    diamondBalance.textContent = formatNumber(currentProfile.diamonds);
  }

  if (freeRandomChatCount) {
    const used = 10 - currentProfile.randomChatFreeCount;
    freeRandomChatCount.textContent = `${currentProfile.randomChatFreeCount} / 10`;
  }

  if (freeRandomVideoCount) {
    const used = 10 - currentProfile.randomVideoChatFreeCount;
    freeRandomVideoCount.textContent = `${currentProfile.randomVideoChatFreeCount} / 10`;
  }
}

/* =========================================================
   MOBILE MENU
   ========================================================= */

mobileMenuBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  mobileNav?.classList.toggle("show");
});

/* =========================================================
   DROPDOWNS
   ========================================================= */

rewardsMenuBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  rewardsMenu?.classList.toggle("show");
  profileMenu?.classList.remove("show");
});

profileMenuBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  profileMenu?.classList.toggle("show");
  rewardsMenu?.classList.remove("show");
});

document.addEventListener("click", () => {
  rewardsMenu?.classList.remove("show");
  profileMenu?.classList.remove("show");
});

rewardsMenu?.addEventListener("click", (event) => {
  event.stopPropagation();
});

profileMenu?.addEventListener("click", (event) => {
  event.stopPropagation();
});

/* =========================================================
   MOBILE NAV LINKS
   ========================================================= */

document.querySelectorAll(".mobile-nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    mobileNav?.classList.remove("show");
  });
});

/* =========================================================
   LOGOUT
   ========================================================= */

dropdownLogoutBtn?.addEventListener("click", handleLogout);
mobileLogoutBtn?.addEventListener("click", handleLogout);

/* =========================================================
   BUY DIAMONDS (PLACEHOLDER)
   ========================================================= */

buyDiamondsBtn?.addEventListener("click", () => {
  alert("Diamond purchase system will be implemented soon. Coming in next update!");
});

/* =========================================================
   CLOSE MOBILE MENU ON RESIZE
   ========================================================= */

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) {
    mobileNav?.classList.remove("show");
  }
});
