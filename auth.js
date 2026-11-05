
import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ===== OWNER REGISTRATION =====

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const businessName = document.getElementById("businessName").value.trim();
        const ownerName = document.getElementById("ownerName").value.trim();
        const email = document.getElementById("email").value.trim();
        const contact = document.getElementById("contact").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const message = document.getElementById("registerMessage");
        const button = registerForm.querySelector("button");

        message.textContent = "";

        if (password !== confirmPassword) {
            message.textContent = "Passwords do not match.";
            return;
        }

        button.disabled = true;
        button.textContent = "Creating account...";

        try {
            // Create Firebase Authentication account
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;
            const businessId = user.uid;

            await updateProfile(user, {
                displayName: ownerName
            });

            // Create business workspace
            await setDoc(doc(db, "businesses", businessId), {
                businessName: businessName,
                ownerName: ownerName,
                ownerUid: user.uid,
                contact: contact,
                createdAt: serverTimestamp()
            });

            // Create owner membership
            await setDoc(
                doc(db, "businesses", businessId, "members", user.uid),
                {
                    uid: user.uid,
                    name: ownerName,
                    email: email,
                    role: "owner",
                    status: "active",
                    createdAt: serverTimestamp()
                }
            );

            // Save user profile
            await setDoc(doc(db, "users", user.uid), {
                name: ownerName,
                email: email,
                businessId: businessId,
                role: "owner"
            });

            message.style.color = "green";
            message.textContent = "Account created successfully!";

            alert("Welcome to SafeServe, " + ownerName + "!");

            // Dashboard navigation will be added after we
            // reconnect your existing dashboard.

        } catch (error) {
            console.error(error);

            const errors = {
                "auth/email-already-in-use": "This email is already registered.",
                "auth/invalid-email": "Please enter a valid email.",
                "auth/weak-password": "Please choose a stronger password.",
                "auth/network-request-failed": "Check your internet connection.",
                "permission-denied": "Database permission denied. Check Firestore rules."
            };

            message.style.color = "#b42318";
            message.textContent =
                errors[error.code] || error.message;

        } finally {
            button.disabled = false;
            button.textContent = "Create Canteen Account";
        }
    });
}

// ===== USER LOGIN =====

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const message = document.getElementById("loginMessage");
        const button = loginForm.querySelector("button");

        message.textContent = "";
        button.disabled = true;
        button.textContent = "Logging in...";

        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            // Get user's business information
            const profileRef = doc(db, "users", user.uid);

            const { getDoc } = await import(
                "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js"
            );

            const profileSnap = await getDoc(profileRef);

            if (!profileSnap.exists()) {
                throw new Error("User profile not found. Contact your owner.");
            }

            const profile = profileSnap.data();

            // Check business membership
            const memberRef = doc(
                db,
                "businesses",
                profile.businessId,
                "members",
                user.uid
            );

            const memberSnap = await getDoc(memberRef);

            if (!memberSnap.exists() || memberSnap.data().status !== "active") {
                throw new Error("Your business access is not active.");
            }

            // Save current business details for dashboard use
            sessionStorage.setItem("businessId", profile.businessId);
            sessionStorage.setItem("userRole", profile.role);

            window.location.href = "dashboard.html";

        } catch (error) {
            console.error(error);

            message.style.color = "#b42318";
            message.textContent =
                error.message || "Login failed. Please try again.";

        } finally {
            button.disabled = false;
            button.textContent = "Login";
        }
    });
}
