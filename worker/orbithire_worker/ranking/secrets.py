"""Decrypt user API keys stored by the Next.js app (exact port of lib/encryption.ts).

Format: ``salt:iv:tag:ciphertext`` (hex). Key material:
* ``ENCRYPTION_KEY`` (>= 32 chars): its first 32 characters as UTF-8 bytes, else
* ``scrypt(SUPABASE_JWT_SECRET, "api-key-encryption", 32)``.
Per value: ``derived = scrypt(key, salt, 32)`` (Node defaults N=16384, r=8, p=1),
AES-256-GCM with a 16-byte IV and 16-byte tag.

Like the TS version, values without exactly four ``:``-separated parts are returned as-is
(legacy plaintext). Unlike the TS version, a value that has the encrypted shape but fails
to decrypt raises ``DecryptionError`` instead of being returned as if it were a key.
"""

from __future__ import annotations

import hashlib

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY_LENGTH = 32
_SCRYPT = dict(n=16384, r=8, p=1, maxmem=64 * 1024 * 1024, dklen=KEY_LENGTH)


class DecryptionError(ValueError):
    pass


def master_key(encryption_key: str | None, jwt_secret: str | None) -> bytes:
    if encryption_key and len(encryption_key) >= 32:
        # JS: Buffer.from(key.slice(0, 32), "utf-8") - slice counts UTF-16 code units.
        units = encryption_key.encode("utf-16-le")[: 32 * 2]
        return units.decode("utf-16-le", errors="surrogatepass").encode("utf-8", errors="surrogatepass")
    if jwt_secret:
        return hashlib.scrypt(jwt_secret.encode("utf-8"), salt=b"api-key-encryption", **_SCRYPT)
    raise DecryptionError("ENCRYPTION_KEY or SUPABASE_JWT_SECRET must be set for API key decryption")


def decrypt_api_key(value: str | None, *, encryption_key: str | None, jwt_secret: str | None) -> str:
    if not value:
        return ""
    if ":" not in value:
        return value  # legacy plaintext
    parts = value.split(":")
    if len(parts) != 4:
        return value
    salt_hex, iv_hex, tag_hex, ct_hex = parts
    try:
        salt, iv, tag, ct = (bytes.fromhex(x) for x in (salt_hex, iv_hex, tag_hex, ct_hex))
        key = hashlib.scrypt(master_key(encryption_key, jwt_secret), salt=salt, **_SCRYPT)
        return AESGCM(key).decrypt(iv, ct + tag, None).decode("utf-8")
    except DecryptionError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise DecryptionError(f"could not decrypt API key: {type(exc).__name__}") from exc
