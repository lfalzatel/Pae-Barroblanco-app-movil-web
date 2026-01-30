import { useEffect, useRef } from 'react';

/**
 * Hook to handle mobile back button for modals.
 * When the modal opens, it pushes a state to history.
 * When the back button is pressed, it closes the modal.
 * When the modal is closed manually, it removes the history state.
 */
export const useModalBack = (isOpen: boolean, onClose: () => void, modalId: string = 'modal') => {
    // Use a ref for onClose to avoid re-triggering the effect when the callback identity changes
    const onCloseRef = useRef(onClose);
    const isBackRef = useRef(false);

    // Update the ref whenever onClose changes
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            // 1. Push new state when modal opens
            const state = { [modalId]: true };
            window.history.pushState(state, '', window.location.href);

            // 2. Handler for back button
            const handlePopState = (event: PopStateEvent) => {
                // Check if this specific modal's state is still present in the new history entry
                // If it IS present, it means we moved forward to it (or didn't leave it), so don't close.
                // If it is NOT present, we popped it, so we close.

                // Note: event.state is the state of the entry we are activating.
                if (event.state && event.state[modalId]) {
                    // We are still in a history state that "owns" this modal. Do nothing.
                    return;
                }

                // If the user pressed back, we are closing via navigation
                isBackRef.current = true;
                if (onCloseRef.current) {
                    onCloseRef.current();
                }
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
                    // This should only happen if the component is unmounting while open OR if isOpen becomes false
                    // We need to be careful not to call this during a re-render if isOpen is still true
                    // But this cleanup ONLY runs if dependencies change or unmount.
                    // Since we removed onClose from dependencies, this now ONLY runs when isOpen changes to false or component unmounts.
                    // Perfect.
                    window.history.back();
                }
            };
        }
    }, [isOpen, modalId]); // Removed onClose from dependencies
};
