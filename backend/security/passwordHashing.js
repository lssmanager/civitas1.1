const crypto = require("crypto");

const PASSWORD_HASH_POLICY = Object.freeze({
  algorithm: "scrypt",
  keyLength: Number(process.env.PASSWORD_HASH_KEY_LENGTH || 64),
  saltBytes: Number(process.env.PASSWORD_HASH_SALT_BYTES || 16),
  cost: Number(process.env.PASSWORD_HASH_SCRYPT_COST || 16384),
  blockSize: Number(process.env.PASSWORD_HASH_SCRYPT_BLOCK_SIZE || 8),
  parallelization: Number(process.env.PASSWORD_HASH_SCRYPT_PARALLELIZATION || 1),
  maxmem: Number(process.env.PASSWORD_HASH_SCRYPT_MAXMEM || 64 * 1024 * 1024),
});

const scryptAsync = (password, salt, keyLength, options) => new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, keyLength, options, (error, derivedKey) => error ? reject(error) : resolve(derivedKey));
});

async function hashPassword(password, policy = PASSWORD_HASH_POLICY) {
  if (typeof password !== "string" || password.length === 0) throw new Error("Password must be a non-empty string");
  const salt = crypto.randomBytes(policy.saltBytes);
  const hash = await scryptAsync(password, salt, policy.keyLength, { N: policy.cost, r: policy.blockSize, p: policy.parallelization, maxmem: policy.maxmem });
  return `${policy.algorithm}$N=${policy.cost},r=${policy.blockSize},p=${policy.parallelization},l=${policy.keyLength}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function verifyPassword(password, encodedHash) {
  if (typeof encodedHash !== "string") return false;
  const [algorithm, paramText, saltText, hashText] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !paramText || !saltText || !hashText) return false;
  const params = Object.fromEntries(paramText.split(",").map((part) => part.split("=")));
  const expected = Buffer.from(hashText, "base64url");
  const actual = await scryptAsync(password, Buffer.from(saltText, "base64url"), Number(params.l), { N: Number(params.N), r: Number(params.r), p: Number(params.p), maxmem: PASSWORD_HASH_POLICY.maxmem });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = { PASSWORD_HASH_POLICY, hashPassword, verifyPassword };
