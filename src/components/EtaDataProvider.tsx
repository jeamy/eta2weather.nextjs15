'use client';

import React from 'react';

/**
 * Compatibility wrapper. BackgroundSync is the single client-side source for
 * periodic server-state refreshes.
 */
export const EtaDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <>{children}</>;
};
