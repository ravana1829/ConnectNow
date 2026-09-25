# 🔗 ConnectNow - Social Platform

A real-time anonymous social platform for connecting with strangers through text chat, video calls, and group conversations.

## ✨ Recent Updates & Fixes

### ✅ IMPLEMENTED FIXES (Current Release)

#### 1. **Authentication & Index Protection**
- ✅ Index page now protected - unauthenticated users redirect to login
- ✅ User data persistence - user profile data properly saved and loaded
- ✅ Firebase integration - proper authentication with email/phone and guest login
- ✅ Auth-helper module created for unified auth management

#### 2. **UI/Navigation Improvements**
- ✅ ConnectNow official logo added (purple-pink gradient)
- ✅ Brand colors updated - replaced generic blue with signature purple/pink (#7C3AED to #EC4899)
- ✅ Removed duplicate logout button from navigation
- ✅ Removed Settings link (not required in current release)
- ✅ Logo now appears consistently on all pages
- ✅ Subtle animations and transitions added

#### 3. **Wallet & Diamonds System**
- ✅ Wallet page created with diamond balance display
- ✅ Transaction history tracking
- ✅ Free usage counters for Random Chat and Video Call
- ✅ Visual indicators for remaining free uses

#### 4. **Random Chat - Free Usage System**
- ✅ First 10 connections are completely FREE
- ✅ Clear visual counter showing remaining free chats (10 → 9 → 8... → 0)
- ✅ After free count reaches 0, user directed to wallet to purchase diamonds
- ✅ Functional chat interface with message sending
- ✅ User safety features: Report, Block, Next buttons

#### 5. **Random Video Call - Free Usage System**
- ✅ First 10 connections are completely FREE
- ✅ **2-minute time limit** on free video calls
- ✅ Timer displays remaining time during call
- ✅ Call automatically ends after 2 minutes
- ✅ User directed to wallet for premium access
- ✅ Call controls: Mute/Unmute, Camera On/Off, End Call

#### 6. **User Profile & Account Management**
- ✅ User profile properly displays login display name
- ✅ No email addresses shown as display names
- ✅ Avatar generation from user photo or initials
- ✅ Profile dropdown menu with proper Logout option

#### 7. **Responsive Design**
- ✅ Mobile-first responsive design
- ✅ Desktop and mobile navigation both working
- ✅ Touch-friendly UI on mobile devices
- ✅ Proper spacing and sizing for all screen sizes

#### 8. **Branding & Colors**
- ✅ Official ConnectNow logo (heart + video camera icon)
- ✅ Purple (#7C3AED) to Pink (#EC4899) gradient branding
- ✅ Consistent brand colors across all pages
- ✅ Professional, clean, modern design

---

## 🚀 Quick Start

### Option 1: Using Python (Recommended)

```bash
# Navigate to project directory
cd ConnectNow

# Run with Python's built-in server
python3 -m http.server 8000

# Or
npm start
```

Then open `http://localhost:8000/public/user-site/` in your browser.

### Option 2: Using VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click `public/user-site/index.html`
3. Select "Open with Live Server"

### Option 3: Using Node http-server

```bash
npm install -g http-server
npm run serve
```

---

## 📁 Project Structure

```
ConnectNow/
├── public/
│   └── user-site/
│       ├── index.html              # Home page
│       ├── login.html              # Authentication page
│       ├── wallet.html             # Diamond wallet
│       ├── chat.html               # Random chat (NEW)
│       ├── video-call.html         # Random video call (NEW)
│       ├── group-chat.html         # Group chat
│       ├── profile.html            # User profile
│       ├── daily-reward.html       # Daily rewards
│       ├── daily-tasks.html        # Daily tasks
│       ├── css/
│       │   ├── style.css           # Main styles (UPDATED - new colors)
│       │   ├── auth.css            # Auth page styles
│       │   ├── chat.css            # Chat styles
│       │   ├── wallet.css          # Wallet styles
│       │   ├── video-call.css      # Video call styles
│       │   ├── profile.css         # Profile styles
│       │   └── responsive.css      # Mobile responsive
│       ├── js/
│       │   ├── firebase-config.js     # Firebase setup
│       │   ├── auth-helper.js         # Auth utilities (NEW)
│       │   ├── home.js                # Home page logic
│       │   ├── chat-page.js           # Chat page logic (NEW)
│       │   ├── video-call-page.js     # Video call logic (NEW)
│       │   ├── wallet-page.js         # Wallet logic (NEW)
│       │   ├── group-chat.js          # Group chat logic
│       │   └── [other pages...]
│       └── assets/
│           └── logo.png            # ConnectNow logo
├── package.json
└── README.md
```

---

## 🔑 Features Included

### ✅ Core Features
- **Authentication**: Google OAuth + Guest login
- **Random Chat**: Anonymous text messaging with strangers
- **Random Video Call**: Face-to-face communication (2min free)
- **Group Chat**: Join public discussion communities
- **Daily Rewards**: Earn diamonds by checking in daily
- **Daily Tasks**: Complete activities to earn more diamonds
- **Wallet**: Manage diamond balance

### 🆓 Free Features (Current Release)
- **Free Random Chat**: 10 connections per day
- **Free Video Calls**: 10 connections per day (2 minutes each)
- **Free Group Chat**: Unlimited access
- **Free Daily Rewards**: Claim once per day
- **Free Daily Tasks**: Complete for diamonds

---

## 🔐 Firebase Setup

The project uses Firebase Realtime Database and Firebase Authentication.

**Current Configuration:**
- Project ID: `connectnow-1829`
- Auth Domain: `connectnow-1829.firebaseapp.com`
- Storage: `connectnow-1829.firebasestorage.app`

To use with your own Firebase project:
1. Update `firebase-config.js` with your credentials
2. Configure Firestore rules in your Firebase console
3. Enable Google Sign-In and Anonymous auth

---

## 📱 Pages & Routes

| Page | Path | Auth Required | Purpose |
|------|------|---------------|---------|
| Home | `/index.html` | ✅ Yes | Main dashboard |
| Login | `/login.html` | ❌ No | Authentication |
| Random Chat | `/chat.html` | ✅ Yes | Text messaging |
| Video Call | `/video-call.html` | ✅ Yes | Video calling |
| Group Chat | `/group-chat.html` | ✅ Yes | Communities |
| Wallet | `/wallet.html` | ✅ Yes | Diamond management |
| Profile | `/profile.html` | ✅ Yes | User profile |
| Daily Reward | `/daily-reward.html` | ✅ Yes | Reward claim |
| Daily Tasks | `/daily-tasks.html` | ✅ Yes | Task completion |

---

## 🎨 Design System

### Colors
- **Primary**: Purple (#7C3AED)
- **Secondary**: Pink (#EC4899)
- **Gradient**: #7C3AED → #EC4899
- **Text**: #162033
- **Success**: #20a76a
- **Danger**: #dc4b55
- **Warning**: #e39b22

### Typography
- **Font Family**: Inter, system-ui
- **Heading Sizes**: 28px (h1), 20px (h2)
- **Body**: 14-16px
- **Font Weight**: 400 (regular), 600 (semibold), 850 (bold)

### Spacing & Radius
- **Radius Small**: 10px
- **Radius Default**: 16px
- **Radius Large**: 24px

---

## 🛡️ Safety & Moderation

### User Protection Features
- **Report Button**: Flag inappropriate users
- **Block Button**: Prevent future interactions
- **Safety Guidelines**: Displayed on safety section
- **Anonymity**: No real names or email shown (unless user chooses)

### Free Usage Limits
- Prevents abuse and server overload
- Encourages quality over quantity
- Monetization through premium features

---

## 📊 User Data Structure

### Firestore User Document
```json
{
  "userId": "string",
  "displayName": "string",
  "email": "string",
  "photoURL": "string",
  "diamonds": "number",
  "randomChatFreeCount": "number (0-10)",
  "randomVideoChatFreeCount": "number (0-10)",
  "createdAt": "timestamp",
  "lastLogin": "timestamp"
}
```

---

## ⚙️ Configuration

### Environment Variables
Create a `.env` file in the root directory (optional):

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🐛 Known Issues & Future Work

### Phase 2 (Upcoming)
- [ ] Real WebRTC video implementation
- [ ] Payment gateway integration (Stripe, PayPal)
- [ ] Group chat notifications
- [ ] Friend requests & friends list
- [ ] Better user search
- [ ] Chat history & archiving
- [ ] Voice messages
- [ ] Image & file sharing

### Phase 3 (Future)
- [ ] Mobile app (React Native)
- [ ] AI moderation for safety
- [ ] Premium membership features
- [ ] Advanced analytics
- [ ] API for third-party integrations

---

## 📚 Dependencies

### Frontend (No build step required)
- **Firebase SDK** v12.1.0 (loaded via CDN)
- **Vanilla JavaScript** (ES6 modules)
- **CSS3** (no preprocessor needed)

### Backend (Optional)
- **Firebase Firestore** (database)
- **Firebase Authentication** (auth)
- **Firebase Hosting** (deployment)

---

## 🚢 Deployment

### Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize Firebase in your project
firebase init hosting

# Deploy
firebase deploy
```

### Deploy to Vercel

```bash
vercel --prod
```

### Deploy to Netlify

```bash
netlify deploy --prod --dir=public
```

---

## 📞 Support & Contact

For issues, feature requests, or feedback:
- Create an issue in the GitHub repository
- Contact: support@connectnow.com

---

## 📄 License

This project is licensed under the MIT License - see LICENSE.md for details.

---

## ❤️ Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

**Made with ❤️ by the ConnectNow Team**

Connect. Chat. Meet. Discover.
