import { useEffect, useRef } from 'react';

/**
 * Hook to handle mobile back button for modals.
 * When the modal opens, it pushes a state to history.
 * When the back button is pressed, it closes the modal.
 * When the modal is closed manually, it removes the history state.
 */
export const useModalBack = (isOpen: boolean, onClose: () => void, modalId: string = 'modal') => {
    const isBackRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            // 1. Push new state when modal opens
            const state = { [modalId]: true };
            window.history.pushState(state, '', window.location.href);

            // 2. Handler for back button
            const handlePopState = (event: PopStateEvent) => {
                // If the user pressed back, we are closing via navigation
                isBackRef.current = true;
                onClose();
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);

                // 3. Cleanup logic
                if (isBackRef.current) {
                    // Closed via Back Button -> State already popped, just reset flag
                    isBackRef.current = false;
                } else {
                    // Closed via UI (Cancel/Close button) -> We must manually pop the state we added
                    // Check if we can safely go back (optional, but good practice)
                    window.history.back();
                }
            };
        }
    }, [isOpen, onClose, modalId]);
};
