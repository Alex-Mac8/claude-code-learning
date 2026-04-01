const CACHE_NAME = 'claude-code-learning-v2';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './offline.html',
  '../README.md',
  '../week-01/day-01-agent-overview.md',
  '../week-01/day-02-ink-basics.md',
  '../week-01/day-03-ink-advanced.md',
  '../week-01/day-04-tool-system.md',
  '../week-01/day-05-context-management.md',
  '../week-01/day-06-bash-tool.md',
  '../week-01/day-07-week1-project.md',
  '../week-01/quiz-01.json',
  '../week-02/day-08-file-operations.md',
  '../week-02/day-09-glob-grep.md',
  '../week-02/day-10-agent-task.md',
  '../week-02/day-11-query-engine.md',
  '../week-02/day-12-message-ui.md',
  '../week-02/day-13-coordinator.md',
  '../week-02/day-14-week2-project.md',
  '../week-02/quiz-02.json',
  '../week-03/day-15-security.md',
  '../week-03/day-16-anti-distillation.md',
  '../week-03/day-17-prompt-cache.md',
  '../week-03/day-18-performance.md',
  '../week-03/day-19-mcp.md',
  '../week-03/day-20-production.md',
  '../week-03/day-21-capstone.md',
  '../week-03/quiz-03.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache new resources (only markdown and html)
          if (event.request.url.endsWith('.md') || event.request.url.endsWith('.html')) {
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        }).catch(() => {
          // Network failed, return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./offline.html');
          }
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim();
});
