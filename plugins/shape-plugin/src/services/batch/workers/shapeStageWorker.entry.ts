import { expose } from 'comlink';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import { shapeStageWorker } from './shapeStageWorker.js';

const corsProxyBaseURL = typeof import.meta.env?.VITE_CORS_PROXY_BASE_URL === 'string'
  ? import.meta.env.VITE_CORS_PROXY_BASE_URL
  : '';
if (corsProxyBaseURL) {
  setCorsProxyBaseURL(corsProxyBaseURL);
}

expose(shapeStageWorker);
