const html = await (await fetch('http://127.0.0.1:8080/')).text();
console.log('length', html.length);
console.log('has dynamic script', html.includes('loadStats'));
console.log('plans-grid id', html.includes('id="plans-grid"'));
console.log('stat-active', html.includes('id="stat-active"'));
console.log('app link', html.includes('127.0.0.1:8081'));
