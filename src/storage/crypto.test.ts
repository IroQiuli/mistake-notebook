import { describe, it, expect } from 'vitest';
import {
  BackupCryptoError,
  backupCryptoInfo,
  decryptBackup,
  encryptBackup,
  isEncryptedBackupFile,
} from './crypto';

const PASSWORD = 'kaoyan-2027';
const encoder = new TextEncoder();

async function blobOf(text: string) {
  return new Blob([encoder.encode(text)], { type: 'application/zip' });
}

describe('加密备份', () => {
  it('加密后能原样解回来', async () => {
    const plain = await blobOf('错题簿备份 ✓ 数学二');
    const encrypted = await encryptBackup(plain, PASSWORD);

    expect(await isEncryptedBackupFile(encrypted)).toBe(true);
    expect(encrypted.size).toBeGreaterThan(plain.size);

    const restored = await decryptBackup(encrypted, PASSWORD);
    expect(await restored.text()).toBe('错题簿备份 ✓ 数学二');
  });

  it('每次加密的盐和 iv 都不同', async () => {
    const plain = await blobOf('same input');
    const a = await encryptBackup(plain, PASSWORD);
    const b = await encryptBackup(plain, PASSWORD);

    const bytesA = new Uint8Array(await a.arrayBuffer());
    const bytesB = new Uint8Array(await b.arrayBuffer());
    expect(bytesA.length).toBe(bytesB.length);
    expect(Array.from(bytesA.slice(5, 21))).not.toEqual(Array.from(bytesB.slice(5, 21)));
  });

  it('密码错误时报明确错误', async () => {
    const encrypted = await encryptBackup(await blobOf('secret'), PASSWORD);
    await expect(decryptBackup(encrypted, 'wrong-password')).rejects.toBeInstanceOf(
      BackupCryptoError
    );
    await expect(decryptBackup(encrypted, 'wrong-password')).rejects.toThrow('密码不对');
  });

  it('密文被改动后拒绝解密', async () => {
    const encrypted = await encryptBackup(await blobOf('hello'), PASSWORD);
    const bytes = new Uint8Array(await encrypted.arrayBuffer());
    bytes[bytes.length - 1] ^= 0x01;

    await expect(decryptBackup(new Blob([bytes]), PASSWORD)).rejects.toThrow('密码不对');
  });

  it('改头部（盐）也拒绝解密', async () => {
    const encrypted = await encryptBackup(await blobOf('hello'), PASSWORD);
    const bytes = new Uint8Array(await encrypted.arrayBuffer());
    bytes[6] ^= 0xff;

    await expect(decryptBackup(new Blob([bytes]), PASSWORD)).rejects.toThrow('密码不对');
  });

  it('普通 zip 不会被当成加密包', async () => {
    const zip = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])]);
    expect(await isEncryptedBackupFile(zip)).toBe(false);
    await expect(decryptBackup(zip, PASSWORD)).rejects.toThrow('不是加密备份');
  });

  it('头部长度固定，参数可自查', () => {
    expect(backupCryptoInfo.headerBytes).toBe(33);
    expect(backupCryptoInfo.algorithm).toBe('AES-256-GCM');
  });
});
