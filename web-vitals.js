"use strict";

const EMBRACE_KEY = "EMBRACE_METRIC";

const PLATFORMS = {
  RN: "REACT_NATIVE",
  A: "Android",
  I: "iPhone",
  D: "Default",
};

const METRICS = {
  paint: "FCP",
  "largest-contentful-paint": "LCP",
  "layout-shift": "CLS", // 'value' instead of 'duration'.
  "first-input": "FID",
};

/**
 * Functions for sending messages based on the platform
 **/
const sendMessageDefault = console.log;

const sendMessageToAndroid = console.log;

const sendMessageToReactNative = (message) => {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(message);
  } else {
    console.log(message);
  }
};

const sendMessageToIos = (message) => {
  if (window.webkit && window.webkit.messageHandlers?.embrace) {
    window.webkit.messageHandlers.embrace.postMessage(message);
  } else {
    console.log(message);
  }
};

const POST_MESSAGE_BY_PLATFORM = {
  REACT_NATIVE: sendMessageToReactNative,
  /** using values as they comes from the userAgent */
  iPhone: sendMessageToIos,
  Android: sendMessageToAndroid,
  Default: sendMessageDefault,
};

// Function to determine the current platform
function getPlatform() {
  const isRN = !!window.ReactNativeWebView;

  if (isRN) {
    return PLATFORMS.RN;
  }

  const isAndroid = window.navigator.userAgent.includes(PLATFORMS.A);

  if (isAndroid) {
    return PLATFORMS.A;
  }

  const isIos =
    window.webkit && window.navigator.userAgent.includes(PLATFORMS.I);

  if (isIos) {
    return PLATFORMS.I;
  }

  return PLATFORMS.D;
}

const CURRENT_PLATFORM = getPlatform();

/**
 * Parsing and sending vital metrics to Embrace
 */
(function () {
  console.log("SDKs Webview support - POC");

  handleCalculateFID();
  handleCalculateLCP();
  handleCalculateCLS();
  handleCalculateFCP();
})();

/**
 * @param {
 *  message: string;
 * } message
 */
function postMessageToEmbrace(message) {
  const messageToSend = coreVitalParser(message);

  POST_MESSAGE_BY_PLATFORM[CURRENT_PLATFORM](messageToSend);
}

/**
 * @param {{
 *  name: string;
 *  entryType: string;
 *  startTime: double;
 *  duration: double;
 * }[]} vitals
 */
function coreVitalParser(vitals) {
  if (!Array.isArray(vitals)) {
    return console.log("`vitals` is not an array. It's not possible to parse");
  }

  const startTimeStamp = new Date(
    parseInt(window.performance.timeOrigin, 10)
  ).valueOf();
  
  const parsedVitals = JSON.parse(JSON.stringify(vitals)).map(
    ({ name, entryType, startTime, value, processingStart }) => {
      const isFID = METRICS[entryType] === METRICS['first-input'];

      const duration = isFID
        ? parseInt(processingStart - startTime, 10)
        // otherwise use the start time only
        : parseInt(startTime, 10);

      // Parsing core vitals from raw vitals
      return {
        key: EMBRACE_KEY,
        n: !!name ? name : entryType,
        t: METRICS[entryType],
        // "origin time" + "current start_time" (double)
        st: startTimeStamp + parseInt(startTime, 10),
        // custom duration
        d: duration,
        // 'score': only applicable for 'CLS'
        s: value ? value : undefined,
      };
    }
  );

  return JSON.stringify({
    ts: startTimeStamp,
    u: window.location.href,
    vt: parsedVitals,
  });
}

/**
 * Handling FID
 * https://web.dev/fid/#measure-fid-in-javascript
 */
function handleCalculateFID() {
  new PerformanceObserver((entryList) => {
    postMessageToEmbrace(entryList.getEntries());
  }).observe({ type: "first-input", buffered: true });
}

/**
 * Handling FCP
 * https://web.dev/fcp/#measure-fcp-in-javascript
 */
function handleCalculateFCP() {
  new PerformanceObserver((entryList) => {
    postMessageToEmbrace(entryList.getEntries());
  }).observe({ type: "paint", buffered: true });
}

/**
 * Handling LCP
 * https://web.dev/lcp/#measure-lcp-in-javascript
 */
function handleCalculateLCP() {
  new PerformanceObserver((entryList) => {
    postMessageToEmbrace(entryList.getEntries());
  }).observe({ type: "largest-contentful-paint", buffered: true });
}

/**
 * Handling CLS
 * https://web.dev/cls/#measure-cls-in-javascript
 * (basic script)
 */
function handleCalculateCLS() {
  var clsValue = 0;
  var clsEntries = [];

  var sessionValue = 0;
  var sessionEntries = [];

  new PerformanceObserver((entryList) => {
    const rawCLSEntries = entryList.getEntries();

    // should be at least one source to log
    if (rawCLSEntries.every((entry) => entry.sources.length === 0)) {
      return;
    }

    for (const entry of rawCLSEntries) {
      // Only count layout shifts without recent user input.
      if (entry.hadRecentInput) {
        return;
      }

      const firstSessionEntry = sessionEntries[0];
      const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

      // If the entry occurred less than 1 second after the previous entry and
      // less than 5 seconds after the first entry in the session, include the
      // entry in the current session. Otherwise, start a new session.
      if (
        sessionValue &&
        entry.startTime - lastSessionEntry.startTime < 1000 &&
        entry.startTime - firstSessionEntry.startTime < 5000
      ) {
        sessionValue += entry.value;
        sessionEntries.push(entry);
      } else {
        sessionValue = entry.value;
        sessionEntries = [entry];
      }

      // If the current session value is larger than the current CLS value,
      // update CLS and the entries contributing to it.
      if (sessionValue > clsValue) {
        clsValue = sessionValue;
        clsEntries = sessionEntries;

        postMessageToEmbrace(clsEntries);
      }
    }
  }).observe({ type: "layout-shift", buffered: true });
}