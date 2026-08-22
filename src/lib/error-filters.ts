export const DROPPED_ERROR_SUBSTRINGS = [
  "Rejected",
  "is not a valid JavaScript MIME type",
  "Load failed",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "runtime.sendMessage",
  "MetaMask",
  "window.webkit.messageHandlers",
  "sw.js",
  "Service Worker script execution timed out",
  "Failed to register a ServiceWorker",
  "Failed to read the 'localStorage'",
  "The operation is insecure",
  "__firefox__",
  "window.ethereum",
  "SCDynimacBridge",
  "contentScriptData",
  "NotReadableError",
  "AbortError",
  "signal is aborted",
  "plausible.canine.tools",
  "Array buffer allocation failed",
  "Clipboard request was superseded",
  "NotFoundError: The object can not be found here",
  "invalid origin",
  "UnavailableError",
  "No Listener: tabs:outgoing.message.ready",
  "This script should only be loaded in a browser extension",
  "NotSupportedError: Failed to load because no supported source was found",
  "Java object is gone",
  "Error invoking postMessage",
  "Can't find variable: CONFIG",
  "Can't find variable: EmptyRanges",
  "Can't find variable: __gCrWeb",
  "Can't find variable: _G",
  "vc_text_indicators_context is not defined",
  "e.useCache",
  "e.target.tagName.toLowerCase",
  "M_ID",
  "Maximum call stack size exceeded",
  "RangeError: Maximum call stack size exceeded",
  "NotSupportedError: The operation is not supported",
  "captured as promise rejection",
  "lyricsplus",
  "onMessage",
  "contentScriptHrefChanged",
  "prjktla",
  "chrome-extension://",
  "webkit-masked-url",
  "safari-web-extension",
  "__MACOSX",
  "beacon.min.js",
  "ucConfig",
  "getQuettaInfo",
  "provider is not defined",
  "Jsloader error",
  "WKWebView API client did not respond",
  "webkitCurrentPlayback",
  "media.currentTime",
  "Message Timeout",
  "Internal error",
  "Cannot call a class as a function",
  "The fetching process for the media resource was aborted",
  "Fetch is aborted",
  "writeText",
  "Document is not focused",
  "DarkReader",
  "lyrics-plus-backend",
  "__DLD__",
  "frontend.min.js",
  "Request timeout",
  "Distributor",
  "isPredictionAvailable",
  "isDictateAvailable",
  "isMathOcrAvailable",
  "getDictionariesByLanguageId",
  "InvalidStateError",
  "The object is in an invalid state",
  "res.operation",
];

export const EXTENSION_STACK_MARKERS = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
  "edge-extension://",
  "webkit-masked-url",
  "__DLD__",
  "frontend.min.js",
];

export function shouldDropError(msg: string, type: string): boolean {
  if (type.includes("React ErrorBoundary")) return true;
  if (msg === "Aa" || msg === "fa" || msg === "Ba") return true;
  if (/^_0x[0-9a-fA-F]+ is not an Object/i.test(msg)) return true;
  return DROPPED_ERROR_SUBSTRINGS.some((s) => msg.includes(s));
}

export function hasExtensionFrame(event: {
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: { frames?: Array<{ filename?: string; function?: string }> };
    }>;
  };
  culprit?: string;
  transaction?: string;
}): boolean {
  const culprit = event.culprit ?? event.transaction ?? "";
  if (culprit === "qi" || culprit === "OImpt" || culprit === "Pseuu" || culprit === "lBwRB") return true;
  const values = event.exception?.values ?? [];
  for (const v of values) {
    const frames = v.stacktrace?.frames ?? [];
    for (const f of frames) {
      const filename = f.filename ?? "";
      const fn = f.function ?? "";
      if (fn === "qi" || fn === "OImpt" || fn === "Pseuu" || fn === "lBwRB") return true;
      if (EXTENSION_STACK_MARKERS.some((m) => filename.includes(m))) return true;
    }
  }
  return false;
}
