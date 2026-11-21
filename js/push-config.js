// Push notifications are dormant until `workerUrl` is filled in (see worker/README.md).
// The VAPID public key is safe to publish; the private half lives only in the Cloudflare Worker.
export const PUSH = {
  workerUrl: 'https://word-games-league-push.word-games-league-push.workers.dev', // e.g. 'https://word-games-league-push.<your-subdomain>.workers.dev'
  vapidPublicKey: 'BOn3U_dBxsWEOFgvxbiQ_kgpX5kPXfr1MmsDJdvWafh7CtPRrEwqLKe6B5e3AT49EAStUtIBpw_yRB2bnh5cLtU',
};
