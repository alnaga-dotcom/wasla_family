const BASE = 'http://127.0.0.1:8080';
const API = 'http://127.0.0.1:4000';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok: ' + msg); };

const index = await fetch(BASE + '/');
assert(index.status === 200, 'landing index loads');
const cfgRes = await fetch(BASE + '/config.json');
assert(cfgRes.status === 200, 'landing config.json loads');
const cfg = await cfgRes.json();
assert(cfg.apiBase === API && cfg.appUrl === 'http://127.0.0.1:8081', 'landing config.json points to local services');

const html = await index.text();
assert(html.includes('وصلــه'), 'landing has brand');
assert(html.includes('loadStats'), 'landing loads dynamic stats script');
assert(html.includes('loadPlans'), 'landing loads dynamic plans script');
assert(html.includes('data-app-link'), 'landing links to app via config');

const statsRes = await fetch(API + '/api/public/stats');
assert(statsRes.status === 200, 'public stats endpoint reachable');
const stats = await statsRes.json();
assert(Number.isFinite(stats.activeMembers) && stats.activeMembers >= 0, 'activeMembers is a number');
assert(Number.isFinite(stats.verifiedMembers) && stats.verifiedMembers >= 0, 'verifiedMembers is a number');
assert(Number.isFinite(stats.matches) && stats.matches >= 0, 'matches is a number');
assert(Number.isFinite(stats.messages) && stats.messages >= 0, 'messages is a number');

const plansRes = await fetch(API + '/api/public/plans');
assert(plansRes.status === 200, 'public plans endpoint reachable');
const { plans } = await plansRes.json();
assert(plans.length >= 2, 'at least 2 public plans');
assert(plans.every((p) => Number.isFinite(p.price_egp) && p.price_egp <= p.regular_price_egp), 'plans have valid prices');

console.log('ALL LANDING TESTS PASSED');
