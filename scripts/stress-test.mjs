import autocannon from 'autocannon';

const targetUrl = process.argv[2] || 'http://localhost:3000';

console.log(`🔥 Starting stress test against ${targetUrl}...`);
console.log(`Simulating 500 concurrent users for 30 seconds...`);
console.log(`This will aggressively hit the Database via /api/health to test PgBouncer queuing.\n`);

const instance = autocannon({
  url: targetUrl,
  connections: 500, // Simulate 500 real users connected simultaneously
  pipelining: 1, // Send 1 request at a time per connection (like a real browser)
  duration: 30, // Run for 30 seconds
  requests: [
    {
      method: 'GET',
      path: '/', // Tests standard React Server Components / SSR
    },
    {
      method: 'GET',
      path: '/api/health', // Crucial: Tests Prisma -> PgBouncer -> Postgres connection pooling
    }
  ]
});

// Show a cool progress bar in the terminal
autocannon.track(instance, { renderProgressBar: true });

instance.on('done', (result) => {
  console.log('\n✅ Stress Test Completed!\n');
  
  console.log('--- Results ---');
  console.log(`Total Requests Processed: ${result.requests.total}`);
  console.log(`Successful (200 OK):      ${result['2xx']}`);
  console.log(`Failed (500s/400s):       ${result.non2xx}`);
  console.log(`Timeouts/Errors:          ${result.errors}`);
  console.log('\n--- Latency ---');
  console.log(`Average Latency:          ${result.latency.average} ms`);
  console.log(`p99 Latency (slowest 1%): ${result.latency.p99} ms`);
  console.log(`Max Latency:              ${result.latency.max} ms`);
  console.log(`\nThroughput:               ${result.requests.average} requests / second`);
  
  if (result.errors > 0 || result.non2xx > 0) {
    console.log('\n⚠️ WARNING: Your server dropped connections or returned errors under load.');
    console.log('You might need to increase PgBouncer pool_size or check your Next.js logs.');
  } else {
    console.log('\n🚀 SUCCESS! Your Next.js app and PgBouncer handled 500 concurrent users flawlessly!');
  }
});
