/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// کامپوننت‌های دیزاین سیستم (ds/bundle.js) از React و ReactDOM سراسری استفاده می‌کنند.
// پس همان نسخهٔ npm را روی window می‌گذاریم و بعد از آن (به ترتیب import) باندل را بار می‌کنیم.
import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

declare global {
  interface Window {
    React: typeof React;
    ReactDOM: typeof ReactDOM & typeof ReactDOMClient;
  }
}

window.React = React;
window.ReactDOM = Object.assign({}, ReactDOM, ReactDOMClient);
