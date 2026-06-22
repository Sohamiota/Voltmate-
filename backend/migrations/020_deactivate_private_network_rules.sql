-- Private LAN ranges (192.168.x.x, 10.x.x.x, etc.) are never visible to the server
-- when employees use the web app — only the office public internet IP is sent.
-- Deactivate any such rules so attendance checks stop failing for everyone in office.
UPDATE allowed_networks
SET is_active = false
WHERE is_active = true
  AND (
    ip_cidr ~* '^10\.'
    OR ip_cidr ~* '^192\.168\.'
    OR ip_cidr ~* '^172\.(1[6-9]|2[0-9]|3[0-1])\.'
    OR ip_cidr ~* '^127\.'
    OR ip_cidr ~* '^169\.254\.'
    OR ip_cidr ~* '^::1'
    OR ip_cidr ~* '^localhost'
  );
