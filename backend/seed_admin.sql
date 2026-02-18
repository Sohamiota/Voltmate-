INSERT INTO users (name,email,password_hash,is_verified,is_approved,role,created_at)
VALUES ('Local Admin','localadmin@example.com','$2b$10$YTDlylQeua3cTXZEt9LAmuUf8mznz5guqIvtSs4ICCMJH/U4AbY/i', true, true, 'admin', now())
ON CONFLICT (email) DO NOTHING;

