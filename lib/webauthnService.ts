/**
 * Servicio de Autenticación Biométrica (Passkeys / WebAuthn)
 * Permite autenticar mediante Huella Digital, Face ID, Touch ID o Windows Hello.
 */

export interface BiometricAccountInfo {
    rawId: string;
    userEmail: string;
    userId: string;
    registeredAt: string;
}

const STORAGE_KEY = 'pae_biometric_auth';

/**
 * Comprueba si el dispositivo y navegador actual soportan autenticación biométrica nativa.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    try {
        const hasWebAuthn = !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
        if (!hasWebAuthn) return false;

        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
        return true;
    } catch (err) {
        console.error('Error al comprobar disponibilidad de biometría:', err);
        return false;
    }
}

/**
 * Comprueba si existe una biometría vinculada previamente en este dispositivo.
 */
export function hasLinkedBiometrics(): boolean {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return !!stored;
}

/**
 * Obtiene la información de la cuenta biométrica vinculada.
 */
export function getLinkedBiometricsInfo(): BiometricAccountInfo | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Registra la biometría del dispositivo actual para el usuario autenticado.
 */
export async function registerBiometrics(userEmail: string, userId: string): Promise<{ success: boolean; message: string }> {
    if (typeof window === 'undefined') {
        return { success: false, message: 'Operación no disponible en el servidor' };
    }

    const available = await isBiometricsAvailable();
    if (!available) {
        return { 
            success: false, 
            message: 'Tu dispositivo o navegador no soporta autenticación biométrica nativa (Huella / Face ID).' 
        };
    }

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const userIdBuffer = new TextEncoder().encode(userId);

        const publicKeyOptions: PublicKeyCredentialCreationOptions = {
            challenge: challenge.buffer,
            rp: {
                name: 'Sistema PAE - IE Barroblanco',
                id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname
            },
            user: {
                id: userIdBuffer,
                name: userEmail,
                displayName: userEmail.split('@')[0]
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' },   // ES256 (Común en Android/iOS)
                { alg: -257, type: 'public-key' }  // RS256 (Windows Hello)
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'preferred',
                residentKey: 'preferred'
            },
            timeout: 60000
        };

        const credential = await navigator.credentials.create({
            publicKey: publicKeyOptions
        }) as PublicKeyCredential;

        if (!credential) {
            return { success: false, message: 'No se pudo crear el registro biométrico.' };
        }

        const bytes = new Uint8Array(credential.rawId);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const rawIdBase64 = btoa(binary);

        const accountInfo: BiometricAccountInfo = {
            rawId: rawIdBase64,
            userEmail,
            userId,
            registeredAt: new Date().toISOString()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(accountInfo));

        return { 
            success: true, 
            message: '¡Biometría vinculada correctamente a este dispositivo!' 
        };

    } catch (err: any) {
        console.error('Error al registrar biometría:', err);

        if (err.name === 'NotAllowedError') {
            return { success: false, message: 'Operación cancelada por el usuario o tiempo agotado.' };
        }

        return { 
            success: false, 
            message: `Error al vincular biometría: ${err.message || 'Error desconocido'}` 
        };
    }
}

/**
 * Autentica mediante la biometría registrada en este dispositivo.
 */
export async function verifyBiometrics(): Promise<{ success: boolean; accountInfo?: BiometricAccountInfo; message: string }> {
    if (typeof window === 'undefined') {
        return { success: false, message: 'Operación no disponible en el servidor' };
    }

    const info = getLinkedBiometricsInfo();
    if (!info) {
        return { success: false, message: 'No hay ninguna biometría vinculada en este dispositivo.' };
    }

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKeyOptions: PublicKeyCredentialRequestOptions = {
            challenge: challenge.buffer,
            timeout: 60000,
            userVerification: 'preferred'
        };

        const credential = await navigator.credentials.get({
            publicKey: publicKeyOptions
        }) as PublicKeyCredential;

        if (!credential) {
            return { success: false, message: 'No se pudo verificar la lectura biométrica.' };
        }

        return {
            success: true,
            accountInfo: info,
            message: 'Verificación biométrica completada con éxito.'
        };

    } catch (err: any) {
        console.error('Error al verificar biometría:', err);

        if (err.name === 'NotAllowedError') {
            return { success: false, message: 'Lectura biométrica cancelada.' };
        }

        return {
            success: false,
            message: `Error al verificar biometría: ${err.message || 'Desconocido'}`
        };
    }
}

/**
 * Elimina la vinculación biométrica de este dispositivo.
 */
export function clearBiometrics(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}
