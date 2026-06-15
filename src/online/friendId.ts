// A stable, human-friendly Friend ID for every account: "MK-" + 7 digits.
// Generated on the device on first use and persisted, so the player always has
// an ID to show/share immediately — even before the online session resolves.
// The same value is proposed to the server as the account's player_code, so the
// offline ID and the real online ID stay identical.
const KEY = "kok_friend_id";

function gen(): string {
  let n = "";
  for (let i = 0; i < 7; i++) n += Math.floor(Math.random() * 10);
  return `MK-${n}`;
}

export function getLocalFriendId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^MK-\d{7}$/.test(id)) { id = gen(); localStorage.setItem(KEY, id); }
    return id;
  } catch {
    return gen();
  }
}

/** Sync the stored Friend ID to the authoritative code returned by the server
 *  (in case the proposed one collided and the server issued a different one). */
export function setLocalFriendId(code: string): void {
  try { if (code) localStorage.setItem(KEY, code); } catch { /* ignore */ }
}
