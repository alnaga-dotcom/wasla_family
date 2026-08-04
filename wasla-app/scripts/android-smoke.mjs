import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const APK = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

assert(existsSync(APK), 'APK file exists at ' + APK);
const size = statSync(APK).size;
assert(size > 1_000_000, `APK size is reasonable (${size} bytes)`);

console.log('ALL ANDROID BUILD TESTS PASSED');
console.log('APK:', APK);
