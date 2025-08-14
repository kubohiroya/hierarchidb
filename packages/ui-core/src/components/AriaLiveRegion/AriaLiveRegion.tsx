/**
 * @file AriaLiveRegion.tsx
 * @description Global aria-live region for screen reader announcements
 * @module components/ui/AriaLiveRegion
 */

import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

export type AriaLiveMode = 'polite' | 'assertive';

interface AriaLiveMessage {
  id: string;
  message: string;
  mode: AriaLiveMode;
  timestamp: number;
}

// Global message queue
let messageQueue: AriaLiveMessage[] = [];
const listeners: Set<(messages: AriaLiveMessage[]) => void> = new Set();

/**
 * Add a message to the aria-live region
 * @param message - The message to announce
 * @param mode - The aria-live mode ('polite' or 'assertive')
 */
export function announceToScreenReader(message: string, mode: AriaLiveMode = 'polite') {
  const newMessage: AriaLiveMessage = {
    id: `${Date.now()}-${Math.random()}`,
    message,
    mode,
    timestamp: Date.now(),
  };

  messageQueue.push(newMessage);

  // Remove old messages after 5 seconds
  setTimeout(() => {
    messageQueue = messageQueue.filter((m) => m.id !== newMessage.id);
    notifyListeners();
  }, 5000);

  notifyListeners();
}

function notifyListeners() {
  listeners.forEach((listener) => listener([...messageQueue]));
}

/**
 * AriaLiveRegion component that provides screen reader announcements
 *
 * @example
 * ```tsx
 * // Add to your app root
 * <AriaLiveRegion />
 *
 * // Use from anywhere in your app
 * announceToScreenReader('File uploaded successfully');
 * announceToScreenReader('Error: Invalid file format', 'assertive');
 * ```
 */
export function AriaLiveRegion() {
  const [messages, setMessages] = useState<AriaLiveMessage[]>([]);
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessages = (newMessages: AriaLiveMessage[]) => {
      setMessages(newMessages);
    };

    listeners.add(handleMessages);
    return () => {
      listeners.delete(handleMessages);
    };
  }, []);

  const politeMessages = messages.filter((m) => m.mode === 'polite');
  const assertiveMessages = messages.filter((m) => m.mode === 'assertive');

  return (
    <>
      {/* Polite announcements */}
      <Box ref={politeRef} aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {politeMessages.map((msg) => (
          <div key={msg.id}>{msg.message}</div>
        ))}
      </Box>

      {/* Assertive announcements for errors and critical updates */}
      <Box
        ref={assertiveRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      >
        {assertiveMessages.map((msg) => (
          <div key={msg.id}>{msg.message}</div>
        ))}
      </Box>
    </>
  );
}
