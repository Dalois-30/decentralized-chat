import { Buffer } from 'buffer';
import process from 'process';

window.global = window;
window.process = process;
window.Buffer = Buffer;

// Polyfills supplémentaires pour IPFS
window.setImmediate = window.setTimeout;
window.clearImmediate = window.clearTimeout;

// Polyfills pour les modules Node.js
if (!window.process?.versions?.node) {
  window.process.versions = { node: '16.0.0' };
}

// Polyfills pour les streams
if (!window.process?.nextTick) {
  window.process.nextTick = setTimeout;
}

// Polyfills pour les événements
if (!window.process?.env) {
  window.process.env = { NODE_ENV: process.env.NODE_ENV };
}