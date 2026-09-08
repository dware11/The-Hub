'use client';

import { useEffect, useRef } from 'react';
import { trackEngagement } from '../lib/engagement';

export default function EngagementTracker({ contentType, contentId, action }) {
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    trackEngagement({ contentType, contentId: String(contentId), action });
  }, [contentType, contentId, action]);
  return null;
}

export function TrackedExternalLink({ contentType, contentId, action, onClick, children, ...props }) {
  return <a
    {...props}
    onClick={(event) => {
      trackEngagement({ contentType, contentId: String(contentId), action });
      onClick?.(event);
    }}
  >{children}</a>;
}
