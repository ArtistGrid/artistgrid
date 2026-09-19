import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
export async function fastHash(input: string): Promise<string> {
  const digest = blake3(new TextEncoder().encode(input), { dkLen: 8 });
  return bytesToHex(digest);
}
