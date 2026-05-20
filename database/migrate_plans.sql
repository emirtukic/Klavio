-- Migrate subscription plans: trial/basic/enterprise → starter/pro/klub
USE club_management;

-- Step 1: Expand ENUMs to include both old and new values (required before data update)
ALTER TABLE club_subscriptions
  MODIFY COLUMN plan ENUM('trial','basic','pro','enterprise','starter','klub') DEFAULT 'starter';
ALTER TABLE club_subscriptions
  MODIFY COLUMN status ENUM('trial','active','overdue','cancelled') DEFAULT 'active';

-- Step 2: Migrate existing data
UPDATE club_subscriptions SET plan = 'starter' WHERE plan IN ('trial', 'basic');
UPDATE club_subscriptions SET plan = 'klub'    WHERE plan = 'enterprise';
UPDATE club_subscriptions SET status = 'active' WHERE status = 'trial';

-- Step 3: Lock ENUMs to final values only
ALTER TABLE club_subscriptions
  MODIFY COLUMN plan ENUM('starter','pro','klub') DEFAULT 'starter';
ALTER TABLE club_subscriptions
  MODIFY COLUMN status ENUM('active','overdue','cancelled') DEFAULT 'active';
