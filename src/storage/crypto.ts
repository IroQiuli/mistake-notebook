/**
 * 备份包加密：口令 → PBKDF2-SHA256 → AES-256-GCM。
 *
 * 文件结构（共 33 字节头 + 密文）：
 *   "CTBX" | 版本(1) | salt(16) | iv(12) | AES-GCM 密文(含 16 字节 tag)
 * 头部整体作为 AAD 参与认证，改动任何一位都会解密失败。
 */

const MAGIC = new Uint8Array([0x43, 0x54, 0x42, 0x58]); // "CTBX"
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN; // 33

/** 迭代次数：OWASP 2023 对 PBKDF2-HMAC-SHA256 的建议值 */
const ITERATIONS = 600_000;

export class BackupCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupCryptoError';
  }
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) {
    throw new BackupCryptoError('当前环境不支持加密（请用 https 或 localhost 打开本页）');
  }
  return s;
}

/** 复制成独立的 ArrayBuffer，WebCrypto 只接受 BufferSource */
function toBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

async function readHead(file: Blob, n: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, n).arrayBuffer());
}

/** 判断一个文件是否是加密备份（只看魔数，不做解密） */
export function isEncryptedBackup(head: Uint8Array): boolean {
  if (head.length < MAGIC.length) return false;
  return MAGIC.every((b, i) => head[i] === b);
}

/** 读文件头判断是否为加密备份，供 UI 在导入前决定要不要问密码 */
export async function isEncryptedBackupFile(file: Blob): Promise<boolean> {
  return isEncryptedBackup(await readHead(file, HEADER_LEN));
}

async function deriveKey(password: string, salt: Uint8Array, usage: 'encrypt' | 'decrypt') {
  const s = subtle();
  const base = await s.importKey(
    'raw',
    toBuffer(new TextEncoder().encode(password.normalize('NFKC'))),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return s.deriveKey(
    { name: 'PBKDF2', salt: toBuffer(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  );
}

/** 把任意文件加密成 .ctbx 二进制包 */
export async function encryptBackup(plain: Blob, password: string): Promise<Blob> {
  if (!password) throw new BackupCryptoError('请设置备份密码');
  const s = subtle();
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);

  const header = new Uint8Array(HEADER_LEN);
  header.set(MAGIC, 0);
  header[MAGIC.length] = VERSION;
  header.set(salt, MAGIC.length + 1);
  header.set(iv, MAGIC.length + 1 + SALT_LEN);

  const key = await deriveKey(password, salt, 'encrypt');
  const cipher = await s.encrypt(
    { name: 'AES-GCM', iv: toBuffer(iv), additionalData: toBuffer(header), tagLength: 128 },
    key,
    await plain.arrayBuffer()
  );

  return new Blob([header, cipher], { type: 'application/octet-stream' });
}

/** 解密 .ctbx；密码错误或文件被改动都抛 BackupCryptoError */
export async function decryptBackup(file: Blob, password: string): Promise<Blob> {
  const head = await readHead(file, HEADER_LEN);
  if (!isEncryptedBackup(head)) throw new BackupCryptoError('这不是加密备份文件');
  if (head[MAGIC.length] !== VERSION) {
    throw new BackupCryptoError(`加密备份版本 ${head[MAGIC.length]} 与当前版本 ${VERSION} 不兼容`);
  }

  const salt = head.slice(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN);
  const iv = head.slice(MAGIC.length + 1 + SALT_LEN, HEADER_LEN);
  const body = await file.slice(HEADER_LEN).arrayBuffer();
  const key = await deriveKey(password, salt, 'decrypt');

  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: toBuffer(iv), additionalData: toBuffer(head), tagLength: 128 },
      key,
      body
    );
    return new Blob([plain], { type: 'application/zip' });
  } catch {
    throw new BackupCryptoError('密码不对，或备份文件已损坏');
  }
}

export const backupCryptoInfo = {
  headerBytes: HEADER_LEN,
  iterations: ITERATIONS,
  algorithm: 'AES-256-GCM',
  kdf: 'PBKDF2-SHA256',
};
