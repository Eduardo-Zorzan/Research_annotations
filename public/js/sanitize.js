const BLOCKED_TAGS = new Set([
    "script",
    "style",
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "link",
    "meta",
    "base",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "svg",
    "math",
    "template",
    "noscript",
]);
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction", "srcset", "background", "poster"]);
const URL_DATA_KEYS = new Set(["url", "embed", "source", "link", "href"]);
const PLAIN_TEXT_DATA_KEYS = new Set(["code"]);
export function isUnsafeUrl(value) {
    const normalized = value.replace(/[\u0000- \u007f]/g, "").toLowerCase();
    return (normalized.startsWith("javascript:") ||
        normalized.startsWith("vbscript:") ||
        (normalized.startsWith("data:") && !normalized.startsWith("data:image/")));
}
function cleanTree(root) {
    Array.from(root.querySelectorAll("*")).forEach((el) => {
        if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) {
            el.remove();
            return;
        }
        Array.from(el.attributes).forEach((attr) => {
            const name = attr.name.toLowerCase();
            if (name.startsWith("on") || name === "srcdoc" || (URL_ATTRIBUTES.has(name) && isUnsafeUrl(attr.value))) {
                el.removeAttribute(attr.name);
            }
        });
    });
}
export function parseSafeHtml(html) {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    cleanTree(body);
    return body;
}
export function sanitizeHtml(html) {
    if (!html.includes("<"))
        return html;
    return parseSafeHtml(html).innerHTML;
}
export function sanitizeEditorData(value, key = "") {
    if (typeof value === "string") {
        if (URL_DATA_KEYS.has(key))
            return isUnsafeUrl(value) ? "" : value;
        if (PLAIN_TEXT_DATA_KEYS.has(key))
            return value;
        return sanitizeHtml(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeEditorData(item, key));
    }
    if (value && typeof value === "object") {
        const result = {};
        Object.keys(value).forEach((childKey) => {
            result[childKey] = sanitizeEditorData(value[childKey], childKey);
        });
        return result;
    }
    return value;
}
