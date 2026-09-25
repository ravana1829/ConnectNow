/* =========================================================
   CONNECTNOW RANDOM CHAT PAGE
   REAL 2-USER RANDOM CHAT
   ========================================================= */

import {
  protectPage,
  onAuthReady,
  currentProfile,
  handleLogout,
  decrementFreeRandomChat,
  setAvatar
} from "./auth-helper.js";

import RandomMatcher from "./random-matcher.js";


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

const freeCountDisplay =
  document.getElementById("freeCountDisplay");

const chatMessages =
  document.getElementById("chatMessages");

const messageInput =
  document.getElementById("messageInput");

const sendBtn =
  document.getElementById("sendBtn");

const stopChatBtn =
  document.getElementById("stopChatBtn");

const reportBtn =
  document.getElementById("reportBtn");

const blockBtn =
  document.getElementById("blockBtn");

const nextBtn =
  document.getElementById("nextBtn");

const usageWarning =
  document.getElementById("usageWarning");


/* =========================================================
   STATE
   ========================================================= */

let chatActive =
  false;

let searching =
  false;

let startingChat =
  false;

let nextInProgress =
  false;

let hasCountedCurrentMatch =
  false;

let connectedPerson =
  null;

let typingStopTimer =
  null;


/* =========================================================
   PAGE START
   ========================================================= */

protectPage()
  .then(
    (success) => {

      if (!success) {
        return;
      }


      onAuthReady(
        (user, profile) => {

          if (!user || !profile) {
            return;
          }


          updateUI();

          updateControls();

          bindMatcherEvents();


          /*
            Auto-start only once.
          */
          setTimeout(
            () => {

              if (
                currentProfile &&
                Number(
                  currentProfile.randomChatFreeCount ||
                  0
                ) > 0
              ) {

                startChat();

              } else {

                showUsageWarning();

              }

            },
            300
          );

        }
      );

    }
  )
  .catch(
    (error) => {

      console.error(
        "Random Chat page initialization error:",
        error
      );

      showSystemMessage(
        "Unable to initialize Random Chat."
      );

    }
  );


/* =========================================================
   UI UPDATE
   ========================================================= */

function updateUI() {

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


  if (dropdownUserName) {

    dropdownUserName.textContent =
      name;

  }


  if (dropdownUserEmail) {

    /*
      Do not show email to normal chat area.
      Dropdown can still use account email
      if the existing UI expects it.
    */
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


  updateFreeCount();

}


/* =========================================================
   FREE COUNT
   ========================================================= */

function updateFreeCount() {

  if (!freeCountDisplay) {
    return;
  }


  const count =
    Number(
      currentProfile?.randomChatFreeCount ||
      0
    );


  freeCountDisplay.textContent =
    String(
      Math.max(
        0,
        count
      )
    );

}


/* =========================================================
   USAGE WARNING
   ========================================================= */

function showUsageWarning() {

  if (usageWarning) {

    usageWarning.style.display =
      "block";

  }

}


function hideUsageWarning() {

  if (usageWarning) {

    usageWarning.style.display =
      "none";

  }

}


/* =========================================================
   CONTROLS
   ========================================================= */

function updateControls() {

  const active =
    chatActive;

  const busy =
    startingChat ||
    searching ||
    nextInProgress;


  if (messageInput) {

    messageInput.disabled =
      !active;

  }


  if (sendBtn) {

    sendBtn.disabled =
      !active;

  }


  if (stopChatBtn) {

    stopChatBtn.disabled =
      !active;

  }


  if (reportBtn) {

    reportBtn.disabled =
      !active;

  }


  if (blockBtn) {

    blockBtn.disabled =
      !active;

  }


  if (nextBtn) {

    nextBtn.disabled =
      busy && !active;

  }

}


/* =========================================================
   SYSTEM MESSAGE
   ========================================================= */

function showSystemMessage(
  text
) {

  if (!chatMessages) {
    return;
  }


  chatMessages.innerHTML =
    "";


  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "message system";


  const message =
    document.createElement(
      "div"
    );

  message.textContent =
    String(
      text ||
      ""
    );


  wrapper.appendChild(
    message
  );


  chatMessages.appendChild(
    wrapper
  );


  scrollToBottom();

}


/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessage(
  text,
  type = "other",
  displayName = ""
) {

  if (!chatMessages) {
    return;
  }


  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    `message ${type}`;


  if (
    displayName &&
    type === "other"
  ) {

    const name =
      document.createElement(
        "strong"
      );

    name.textContent =
      displayName;


    wrapper.appendChild(
      name
    );


    const breakElement =
      document.createElement(
        "br"
      );


    wrapper.appendChild(
      breakElement
    );

  }


  const textElement =
    document.createElement(
      "span"
    );

  textElement.textContent =
    String(
      text ||
      ""
    );


  wrapper.appendChild(
    textElement
  );


  chatMessages.appendChild(
    wrapper
  );


  scrollToBottom();

}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

  if (!chatMessages) {
    return;
  }


  chatMessages.scrollTop =
    chatMessages.scrollHeight;

}


/* =========================================================
   BIND MATCHER EVENTS
   ========================================================= */

function bindMatcherEvents() {

  RandomMatcher.getMessages(
    (data = {}) => {

      /*
        Server broadcasts the message to both users.
        We already display our own message locally,
        so only render the partner's message here.
      */

      const currentUserId =
        currentProfile?.userId || "";


      if (
        data.userId &&
        data.userId === currentUserId
      ) {

        return;

      }


      if (!chatActive) {
        return;
      }


      addMessage(
        data.message || "",
        "other",
        data.displayName || "Stranger"
      );

    }
  );


  RandomMatcher.onTyping(
    (data = {}) => {

      if (!chatActive) {
        return;
      }


      const currentUserId =
        currentProfile?.userId || "";


      if (
        data.userId === currentUserId
      ) {

        return;

      }


      updateTypingIndicator(
        Boolean(
          data.typing
        )
      );

    }
  );


  RandomMatcher.onPartnerDisconnected(
    () => {

      if (!chatActive) {
        return;
      }


      chatActive =
        false;

      searching =
        false;

      startingChat =
        false;


      addMessage(
        "The other person has left the chat.",
        "system"
      );


      connectedPerson =
        null;


      updateControls();

    }
  );


  RandomMatcher.onEnd(
    () => {

      chatActive =
        false;

      searching =
        false;

      startingChat =
        false;

      connectedPerson =
        null;

      updateControls();

    }
  );


  RandomMatcher.onServerError(
    (message) => {

      searching =
        false;

      startingChat =
        false;

      chatActive =
        false;

      showSystemMessage(
        `❌ ${message}`
      );

      updateControls();

    }
  );

}


/* =========================================================
   TYPING INDICATOR
   ========================================================= */

function updateTypingIndicator(
  typing
) {

  let indicator =
    document.getElementById(
      "randomChatTypingIndicator"
    );


  if (
    !indicator &&
    chatMessages
  ) {

    indicator =
      document.createElement(
        "div"
      );

    indicator.id =
      "randomChatTypingIndicator";

    indicator.className =
      "message system";


    chatMessages.appendChild(
      indicator
    );

  }


  if (!indicator) {
    return;
  }


  if (typing) {

    indicator.textContent =
      `${connectedPerson?.name || "Stranger"} is typing...`;

    scrollToBottom();

  } else {

    indicator.remove();

  }

}


/* =========================================================
   START CHAT
   ========================================================= */

async function startChat() {

  if (
    startingChat ||
    searching
  ) {

    return;

  }


  const freeCount =
    Number(
      currentProfile?.randomChatFreeCount ||
      0
    );


  if (freeCount <= 0) {

    showUsageWarning();

    alert(
      "You have no free random chats remaining. Please visit your wallet."
    );

    return;

  }


  startingChat =
    true;

  searching =
    true;

  chatActive =
    false;

  hasCountedCurrentMatch =
    false;


  hideUsageWarning();

  connectedPerson =
    null;


  updateControls();


  showSystemMessage(
    "🔄 Finding a random person..."
  );


  try {

    /*
      This now uses the backend Socket.IO
      random matching queue.
    */
    const matchedUser =
      await RandomMatcher.findRandomUser();


    if (!matchedUser) {

      throw new Error(
        "No random person was matched."
      );

    }


    const matchId =
      await RandomMatcher.startRandomChat(
        matchedUser
      );


    if (!matchId) {

      throw new Error(
        "The random chat room could not be created."
      );

    }


    connectedPerson =
      {

        id:
          matchedUser.uid ||
          matchedUser.id,

        name:
          matchedUser.displayName ||
          "Stranger"

      };


    chatActive =
      true;

    searching =
      false;

    startingChat =
      false;


    /*
      Count one free usage per real match.
    */
    if (!hasCountedCurrentMatch) {

      hasCountedCurrentMatch =
        true;


      const updated =
        await decrementFreeRandomChat();


      if (!updated) {

        console.warn(
          "Free random chat count could not be updated."
        );

      }

    }


    updateFreeCount();


    const remaining =
      Number(
        currentProfile?.randomChatFreeCount ||
        0
      );


    if (remaining <= 0) {

      showUsageWarning();

    }


    if (chatMessages) {

      chatMessages.innerHTML =
        "";

    }


    addMessage(
      `${connectedPerson.name} has joined the chat. Be respectful!`,
      "system"
    );


    messageInput.disabled =
      false;

    sendBtn.disabled =
      false;

    stopChatBtn.disabled =
      false;

    reportBtn.disabled =
      false;

    blockBtn.disabled =
      false;

    nextBtn.disabled =
      false;


    messageInput.focus();


  } catch (error) {

    console.error(
      "Random Chat start error:",
      error
    );


    chatActive =
      false;

    searching =
      false;

    startingChat =
      false;


    connectedPerson =
      null;


    showSystemMessage(
      "❌ Unable to find a random person right now. Please try again."
    );


  } finally {

    startingChat =
      false;

    searching =
      false;

    updateControls();

  }

}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

  if (!chatActive) {
    return;
  }


  const text =
    String(
      messageInput?.value ||
      ""
    ).trim();


  if (!text) {
    return;
  }


  const sent =
    await RandomMatcher.sendMessage(
      text
    );


  if (!sent) {

    return;

  }


  /*
    Show own message immediately.
    Socket server also broadcasts it to both users,
    but the matcher ignores our own message.
  */
  addMessage(
    text,
    "own"
  );


  messageInput.value =
    "";


  RandomMatcher.setTyping(
    false
  );


  if (typingStopTimer) {

    clearTimeout(
      typingStopTimer
    );

    typingStopTimer =
      null;

  }


  messageInput.focus();

}


/* =========================================================
   NEXT PERSON
   ========================================================= */

async function nextPerson() {

  if (
    nextInProgress ||
    startingChat
  ) {

    return;

  }


  const freeCount =
    Number(
      currentProfile?.randomChatFreeCount ||
      0
    );


  if (freeCount <= 0) {

    showUsageWarning();

    alert(
      "You have no free random chats remaining."
    );

    return;

  }


  nextInProgress =
    true;

  chatActive =
    false;


  updateControls();


  if (messageInput) {
    messageInput.value =
      "";
  }


  showSystemMessage(
    "🔄 Finding the next random person..."
  );


  try {

    /*
      Tell backend to leave the current room.
    */
    await RandomMatcher.nextRandomChat();


    /*
      Start new real match.
    */
    await startChat();


  } catch (error) {

    console.error(
      "Next random chat error:",
      error
    );


    showSystemMessage(
      "❌ Could not find the next person. Please try again."
    );

  } finally {

    nextInProgress =
      false;

    updateControls();

  }

}


/* =========================================================
   STOP CHAT
   ========================================================= */

async function stopChat() {

  if (
    !chatActive &&
    !RandomMatcher.getMatchId()
  ) {

    return;

  }


  chatActive =
    false;


  const oldName =
    connectedPerson?.name ||
    "The other person";


  connectedPerson =
    null;


  updateControls();


  await RandomMatcher.endRandomChat();


  addMessage(
    `${oldName} has left the chat.`,
    "system"
  );


  if (messageInput) {

    messageInput.value =
      "";

  }

}


/* =========================================================
   REPORT
   ========================================================= */

async function reportUser() {

  if (!RandomMatcher.getMatchedUserId()) {

    alert(
      "There is no user to report."
    );

    return;

  }


  const reason =
    prompt(
      "Why are you reporting this user?"
    );


  if (!reason || !reason.trim()) {
    return;
  }


  const submitted =
    await RandomMatcher.reportUser(
      reason.trim()
    );


  if (submitted) {

    alert(
      "Thank you. Your report has been submitted."
    );


    await stopChat();

  } else {

    alert(
      "Unable to submit the report. Please try again."
    );

  }

}


/* =========================================================
   BLOCK
   ========================================================= */

async function blockUser() {

  const userId =
    RandomMatcher.getMatchedUserId();


  if (!userId) {

    alert(
      "There is no user to block."
    );

    return;

  }


  const confirmed =
    confirm(
      "Are you sure you want to block this person?"
    );


  if (!confirmed) {
    return;
  }


  const blocked =
    await RandomMatcher.blockUser(
      userId
    );


  if (blocked) {

    alert(
      "User blocked successfully."
    );


    await stopChat();

  } else {

    alert(
      "Unable to block this user."
    );

  }

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
   REWARDS MENU
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
   PROFILE MENU
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
   MOBILE LINKS
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
   LOGOUT
   ========================================================= */

dropdownLogoutBtn?.addEventListener(
  "click",
  async () => {

    await RandomMatcher.endRandomChat();

    await handleLogout();

  }
);


mobileLogoutBtn?.addEventListener(
  "click",
  async () => {

    await RandomMatcher.endRandomChat();

    await handleLogout();

  }
);


/* =========================================================
   SEND BUTTON
   ========================================================= */

sendBtn?.addEventListener(
  "click",
  sendMessage
);


/* =========================================================
   ENTER TO SEND
   ========================================================= */

messageInput?.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();

    }

  }
);


/* =========================================================
   TYPING EVENTS
   ========================================================= */

messageInput?.addEventListener(
  "input",
  () => {

    if (!chatActive) {
      return;
    }


    RandomMatcher.setTyping(
      true
    );


    if (typingStopTimer) {

      clearTimeout(
        typingStopTimer
      );

    }


    typingStopTimer =
      setTimeout(
        () => {

          RandomMatcher.setTyping(
            false
          );

        },
        700
      );

  }
);


/* =========================================================
   ACTION BUTTONS
   ========================================================= */

stopChatBtn?.addEventListener(
  "click",
  stopChat
);

reportBtn?.addEventListener(
  "click",
  reportUser
);

blockBtn?.addEventListener(
  "click",
  blockUser
);

nextBtn?.addEventListener(
  "click",
  nextPerson
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
   CLEANUP
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    try {

      RandomMatcher.endRandomChat();

    } catch (error) {

      console.warn(
        "Random Chat cleanup warning:",
        error
      );

    }

  }
);