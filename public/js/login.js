import { setCookie } from "./cookies.js";
export function initPasswordToggle(passwordInput, toggleBtn, toggleIcon) {
    toggleBtn.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        toggleIcon.className = isPassword
            ? "fa-solid fa-eye-slash"
            : "fa-solid fa-eye";
    });
}
export function initLoginForm(form, usernameInput, passwordInput, errorAlert, errorText, submitBtn) {
    const showError = (message) => {
        errorText.textContent = message;
        errorAlert.classList.add("visible");
    };
    const hideError = () => {
        errorAlert.classList.remove("visible");
        errorText.textContent = "";
        usernameInput.classList.remove("input-error");
        passwordInput.classList.remove("input-error");
    };
    [usernameInput, passwordInput].forEach((input) => {
        input.addEventListener("input", () => {
            if (errorAlert.classList.contains("visible")) {
                hideError();
            }
        });
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        hideError();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (!username && !password) {
            usernameInput.classList.add("input-error");
            passwordInput.classList.add("input-error");
            showError("Please enter your login and password.");
            usernameInput.focus();
            return;
        }
        if (!username) {
            usernameInput.classList.add("input-error");
            showError("Please enter your login.");
            usernameInput.focus();
            return;
        }
        if (!password) {
            passwordInput.classList.add("input-error");
            showError("Please enter your password.");
            passwordInput.focus();
            return;
        }
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Signing in...</span><i class="fa-solid fa-circle-notch fa-spin"></i>`;
        (async () => {
            try {
                const response = await fetch("/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username,
                        password,
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    setCookie("token", data.token, {
                        days: 14,
                        path: "/",
                        sameSite: "Lax",
                        secure: window.location.protocol === "https:",
                    });
                    window.location.href = "/home";
                    return;
                }
                if (response.status === 401) {
                    showError("Invalid login or password.");
                    usernameInput.classList.add("input-error");
                    passwordInput.classList.add("input-error");
                }
                else {
                    showError("An error occurred during sign in. Please try again.");
                }
            }
            catch (error) {
                showError("An error occurred during sign in. Please try again.");
            }
            finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>Sign In</span><i class="fa-solid fa-arrow-right-to-bracket"></i>`;
            }
        })();
    });
}
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const passwordToggle = document.getElementById("password-toggle");
    const passwordToggleIcon = document.getElementById("password-toggle-icon");
    const errorAlert = document.getElementById("login-error");
    const errorText = document.getElementById("login-error-text");
    const submitBtn = document.getElementById("submit-btn");
    if (passwordInput && passwordToggle && passwordToggleIcon) {
        initPasswordToggle(passwordInput, passwordToggle, passwordToggleIcon);
    }
    if (form &&
        usernameInput &&
        passwordInput &&
        errorAlert &&
        errorText &&
        submitBtn) {
        initLoginForm(form, usernameInput, passwordInput, errorAlert, errorText, submitBtn);
    }
});
