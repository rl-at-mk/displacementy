/**
 * Custom sprite pack storage + identity.
 *
 * A custom pack is an ordered list of image blobs with a user-given name. Its
 * **id is content-addressed** — `custom_` + first 8 hex of a SHA-256 over the
 * file bytes in canonical (filename-sorted) order — so two machines that
 * import the same files derive the same id. That is what lets a shared URL
 * (which carries only pack tokens) be reproduced by a recipient who has the
 * pack, and makes a future pack-zip sharing loop a drop-in.
 *
 * Determinism: the render's PRNG consumption depends on the sprite list's
 * length and order, so in-pack file order must be canonical. Sorting is by
 * **code units** (not locale-aware) so every machine agrees.
 *
 * Persistence is a thin promise wrapper over IndexedDB, kept storage-agnostic
 * at the interface (list/add/delete of `CustomPack`) so a desktop build could
 * back it with the filesystem instead.
 */

export type CustomPack = {
  /** Content-addressed: `custom_<8-hex>` (see `computePackId`). */
  id: string;
  name: string;
  /** Image blobs in canonical (filename-sorted) order. */
  blobs: Blob[];
};

export const CUSTOM_PACK_PREFIX = 'custom_';

/** Whether a spritesPacks token refers to a custom pack (vs a built-in). */
export const isCustomPackToken = (token: string): boolean =>
  token.startsWith(CUSTOM_PACK_PREFIX);

/** Whether a token is a *well-formed* custom pack token (`custom_<8-hex>`). */
export const isValidCustomPackToken = (token: string): boolean =>
  /^custom_[0-9a-f]{8}$/.test(token);

/** Canonical in-pack order: by filename, code-unit comparison (locale-free). */
export const sortFilesByName = <T extends {name: string}>(files: T[]): T[] =>
  [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

/**
 * Content-addressed pack id over the files' bytes in canonical order. The
 * same files produce the same id regardless of selection order.
 */
export const computePackId = async (
  files: Array<{name: string; blob: Blob}>,
): Promise<string> => {
  const sorted = sortFilesByName(files);
  const buffers = await Promise.all(
    sorted.map(async (file) => file.blob.arrayBuffer()),
  );
  const total = buffers.reduce((n, buffer) => n + buffer.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const buffer of buffers) {
    bytes.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest, 0, 4)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${CUSTOM_PACK_PREFIX}${hex}`;
};

/**
 * Reconcile selected pack tokens against the locally-known custom pack ids:
 * built-ins always pass; `custom_*` tokens without a local pack are dropped
 * (a shared URL referenced a pack this browser doesn't have).
 */
export const reconcileSpritePacks = (
  selected: string[],
  knownCustomIds: string[],
): {kept: string[]; dropped: string[]} => {
  const known = new Set(knownCustomIds);
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const token of selected) {
    if (isCustomPackToken(token) && !known.has(token)) dropped.push(token);
    else kept.push(token);
  }
  return {kept, dropped};
};

// ---------------------------------------------------------------------------
// IndexedDB persistence
// ---------------------------------------------------------------------------

const DB_NAME = 'displacementy';
const DB_VERSION = 1;
const STORE_NAME = 'spritePacks';

const openDb = async (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, {keyPath: 'id'});
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(
        db.transaction(STORE_NAME, mode).objectStore(STORE_NAME),
      );
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB request failed'));
      };
    });
  } finally {
    db.close();
  }
};

/** All stored packs (unsorted; callers order by id for canonical use). */
export const listPacks = async (): Promise<CustomPack[]> =>
  withStore('readonly', (store) => store.getAll() as IDBRequest<CustomPack[]>);

/** Insert (or overwrite — same content ⇒ same id ⇒ idempotent) a pack. */
export const addPack = async (pack: CustomPack): Promise<void> => {
  await withStore('readwrite', (store) => store.put(pack));
};

export const deletePack = async (id: string): Promise<void> => {
  await withStore('readwrite', (store) => store.delete(id));
};
