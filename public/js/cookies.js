export function setCookie(name, value, options = {}) {
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (options.days) {
        const date = new Date();
        date.setTime(date.getTime() + options.days * 24 * 60 * 60 * 1000);
        cookieString += `; expires=${date.toUTCString()}`;
    }
    if (options.maxAge !== undefined) {
        cookieString += `; max-age=${options.maxAge}`;
    }
    cookieString += `; path=${options.path || "/"}`;
    if (options.domain) {
        cookieString += `; domain=${options.domain}`;
    }
    if (options.sameSite) {
        cookieString += `; SameSite=${options.sameSite}`;
    }
    if (options.secure) {
        cookieString += "; Secure";
    }
    document.cookie = cookieString;
}
export function getCookie(name) {
    const nameEQ = `${encodeURIComponent(name)}=`;
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === " ") {
            c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
}
export function deleteCookie(name, path = "/", domain) {
    let cookieString = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
    if (domain) {
        cookieString += `; domain=${domain}`;
    }
    document.cookie = cookieString;
}
