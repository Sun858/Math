# 🧠 Math Brain Booster Pro

> A free, offline-capable, adaptive math trainer that installs to your iPhone home screen — no App Store, no subscriptions, no accounts.

![License](https://img.shields.io/badge/license-MIT-blue)
![PWA](https://img.shields.io/badge/PWA-ready-ff5c7a)
![API](https://img.shields.io/badge/API-OpenTDB%20%2B%20Newton-19c3e6)
![Cost](https://img.shields.io/badge/cost-100%25%20free-brightgreen)

---

## 🎯 What It Is

A progressive web app (PWA) that quizzes you on math — starting at basic arithmetic and climbing all the way to calculus. Questions come from three sources:

1. **Live API questions** (OpenTDB) that adapt to your level
2. **Symbolic math** (Newton API) that generates real derivatives, integrals, and factorisations
3. **Local generators** that guarantee the game works even when offline

The game **learns your skill level** — score 8+/10 and you climb. Score 4/10 or below and it eases off. Over weeks, it pushes you to the edge of what you can solve.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎚️ **10 adaptive levels** | Difficulty adjusts after every round based on your accuracy |
| 🌐 **Live question API** | Fetches fresh math trivia from OpenTDB (categorised by difficulty) |
| ∫ **Symbolic calculus** | Derivatives, integrals, factoring, simplification via Newton API |
| 📴 **Offline mode** | Full local generator fallback — game never breaks |
| 📅 **Daily challenge** | Same questions for everyone on a given date (seeded by day) |
| 💾 **Progress saved** | Level, best streak, and last 30 games stored in `localStorage` |
| 📱 **iPhone home screen app** | Installable PWA, full-screen, works offline |
| 🎨 **Dark themed UI** | Built for late-night study sessions |

---

## 🚀 Live Demo

**Try it now:** [https://YOUR-USERNAME.github.io/math-booster/](https://YOUR-USERNAME.github.io/math-booster/)

_(Replace `YOUR-USERNAME` with your GitHub username after deploying — see below.)_

---

## 📱 Install on Your iPhone

1. Open the live URL in **Safari** (not Chrome — Chrome iOS can't install PWAs)
2. Tap the **Share** button (□ with ↑ arrow)
3. Scroll down and tap **Add to Home Screen**
4. Name it "Math Boost" → tap **Add**

The π icon appears on your home screen. Tap it — the game opens full-screen, no browser chrome, works offline after first load.

---

## 🛠️ Run Locally

```bash
# Clone the repo
git clone https://github.com/YOUR-USERNAME/math-booster.git
cd math-booster

# Serve it (choose one)
python3 -m http.server 8000       # Python 3
# or
npx serve                          # Node.js
# or just open index.html in VS Code with Live Server
