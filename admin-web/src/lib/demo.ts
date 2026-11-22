import {
  grantReward,
  saveAuction,
  saveBadge,
  saveModerationReport,
  saveProfileDoc,
  saveRewardRule,
  saveVerificationRequest,
} from './admin';
import type { Profile, VerificationRequest } from './models';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * Fills the admin collections with the sample content from the
 * `stitch_puran_haat` designs, so every screen can be reviewed before real
 * submissions exist.
 *
 * Every demo row uses a `demo-` document id and a synthetic `demo-*` user id,
 * so re-running overwrites the same documents and can never collide with a real
 * auth UID.
 *
 * Listings are deliberately *not* seeded: `items` is public-read, so demo
 * entries would show up in the mobile app's Home feed. The admin screens read
 * real listings instead.
 */
export async function loadDemoData(): Promise<void> {
  const now = Date.now();

  const profiles: Profile[] = [
    {
      id: 'demo-alex-rivera',
      full_name: 'Alex "GreenThumb" Rivera',
      username: 'arivera_garden',
      district: 'Dhanmondi, Dhaka',
      bio: 'Weekend gardener trading tools I no longer need.',
      rating: 3.9,
      trade_count: 87,
      eco_points: 320,
      is_verified: false,
      trust_score: 42,
      moderation_status: 'flagged',
      admin_notes: 'Two reports in the last 30 days — monitor message tone.',
      joined_at: now - 400 * DAY,
    },
    {
      id: 'demo-sam-taylor',
      full_name: 'Sam Taylor',
      username: 'samtrades',
      district: 'Uttara, Dhaka',
      rating: 4.4,
      trade_count: 22,
      eco_points: 180,
      is_verified: false,
      trust_score: 68,
      moderation_status: 'flagged',
      joined_at: now - 120 * DAY,
    },
    {
      id: 'demo-sarah-jenkins',
      full_name: 'Sarah Jenkins',
      username: 'sarahj',
      district: 'Gulshan, Dhaka',
      bio: 'Repairing and rehoming small appliances.',
      rating: 4.9,
      trade_count: 64,
      eco_points: 1240,
      is_verified: true,
      trust_score: 96,
      moderation_status: 'clear',
      joined_at: now - 2 * DAY,
    },
    {
      id: 'demo-marcus-johnson',
      full_name: 'Marcus Johnson',
      username: 'marcusj',
      district: 'Banani, Dhaka',
      rating: 4.6,
      trade_count: 41,
      eco_points: 860,
      is_verified: false,
      trust_score: 88,
      moderation_status: 'clear',
      joined_at: now - 12 * HOUR,
    },
    {
      id: 'demo-david-chen',
      full_name: 'David Chen',
      username: 'dchen',
      district: 'Mirpur, Dhaka',
      rating: 4.2,
      trade_count: 33,
      eco_points: 540,
      is_verified: false,
      trust_score: 74,
      moderation_status: 'clear',
      joined_at: now - 3 * DAY,
    },
    {
      id: 'demo-elena-rodriguez',
      full_name: 'Elena Rodriguez',
      username: 'elenarecycles',
      district: 'Bashundhara, Dhaka',
      bio: 'Fixing furniture instead of binning it.',
      rating: 5,
      trade_count: 45,
      eco_points: 2140,
      is_verified: true,
      trust_score: 99,
      moderation_status: 'clear',
      joined_at: now - 500 * DAY,
    },
    {
      id: 'demo-marcus-thorne',
      full_name: 'Marcus Thorne',
      username: 'mthorne',
      district: 'Mohakhali, Dhaka',
      rating: 4.8,
      trade_count: 32,
      eco_points: 1680,
      is_verified: true,
      trust_score: 97,
      moderation_status: 'clear',
      joined_at: now - 320 * DAY,
    },
  ];

  for (const profile of profiles) {
    await saveProfileDoc(profile);
  }

  const verifications: VerificationRequest[] = [
    {
      id: 'demo-ver-sarah',
      user_id: 'demo-sarah-jenkins',
      full_name: 'Sarah Jenkins',
      username: 'sarahj',
      district: 'Gulshan, Dhaka',
      document_type: 'ID & Utility Bill',
      file_count: 2,
      risk_score: 12,
      status: 'pending',
      submitted_at: now - 2 * DAY,
    },
    {
      id: 'demo-ver-marcus',
      user_id: 'demo-marcus-johnson',
      full_name: 'Marcus Johnson',
      username: 'marcusj',
      district: 'Banani, Dhaka',
      document_type: "Driver's License",
      file_count: 1,
      risk_score: 24,
      status: 'pending',
      submitted_at: now - 12 * HOUR,
    },
    {
      id: 'demo-ver-david',
      user_id: 'demo-david-chen',
      full_name: 'David Chen',
      username: 'dchen',
      district: 'Mirpur, Dhaka',
      document_type: 'Incomplete documents',
      file_count: 1,
      risk_score: 58,
      status: 'pending',
      submitted_at: now - 3 * DAY,
      notes: 'Missing proof of address.',
    },
  ];

  for (const request of verifications) {
    await saveVerificationRequest(request);
  }

  await saveModerationReport({
    id: 'demo-report-1',
    user_id: 'demo-alex-rivera',
    type: 'listing',
    title: 'Misleading Listing',
    detail:
      'User reported that the "Gently Used Compost Bin" arrived severely cracked and unusable, contrary to the description.',
    item_title: 'Gently Used Compost Bin — 50L',
    item_id: 'LST-9921',
    created_at: now - 2 * HOUR,
    status: 'open',
  });

  await saveModerationReport({
    id: 'demo-report-2',
    user_id: 'demo-alex-rivera',
    type: 'message',
    title: 'Abusive Language',
    detail:
      'Automated filter flagged a chat message containing prohibited aggressive language during a trade negotiation.',
    created_at: now - DAY - 6 * HOUR,
    status: 'open',
  });

  await saveModerationReport({
    id: 'demo-report-3',
    user_id: 'demo-sam-taylor',
    type: 'account',
    title: 'Inappropriate behaviour',
    detail: 'Repeatedly cancels agreed trades at the meeting point.',
    created_at: now - 3 * HOUR,
    status: 'open',
  });

  await saveAuction({
    id: 'demo-auc-bicycle',
    title: 'Vintage Restored Bicycle',
    description: 'Fully restored 1980s road bike, new tyres and chain.',
    category_id: 'sports',
    starting_bid: 300,
    current_bid: 450,
    participants: 12,
    watchers: 41,
    starts_at: now - HOUR,
    duration_hours: 3,
    status: 'active',
    verified_only: true,
    created_at: now - 2 * DAY,
  });

  await saveAuction({
    id: 'demo-auc-garden',
    title: 'Community Garden Plot Lease',
    description: 'One growing season on a raised bed at the Dhanmondi plot.',
    category_id: 'garden',
    starting_bid: 800,
    current_bid: 1200,
    participants: 34,
    watchers: 96,
    starts_at: now - 4 * HOUR,
    duration_hours: 24,
    status: 'active',
    verified_only: false,
    created_at: now - 3 * DAY,
  });

  await saveAuction({
    id: 'demo-auc-solar',
    title: 'Solar Panel Cleaning Kit',
    description: 'Complete kit with extendable brush and squeegee.',
    category_id: 'tools',
    starting_bid: 50,
    participants: 0,
    watchers: 8,
    starts_at: now + 2 * DAY,
    duration_hours: 48,
    status: 'scheduled',
    verified_only: true,
    created_at: now,
  });

  await saveRewardRule({
    id: 'demo-rule-weekend',
    name: 'Weekend Trades',
    multiplier: 2,
    active: true,
    note: 'Active Sat–Sun',
  });
  await saveRewardRule({
    id: 'demo-rule-first',
    name: 'First Trade Bonus',
    multiplier: 1.5,
    active: true,
    note: 'New users only',
  });
  await saveRewardRule({
    id: 'demo-rule-earthday',
    name: 'Earth Day Promo',
    multiplier: 3,
    active: false,
    note: 'Inactive',
  });

  await saveBadge({
    id: 'demo-badge-hero',
    name: 'Sustainability Hero',
    description: 'Awarded for saving 100kg of CO2 through trades.',
    tier: 3,
    active: true,
    icon: 'eco',
  });
  await saveBadge({
    id: 'demo-badge-fixer',
    name: 'Pro Fixer',
    description: 'Successfully repaired and traded 10 electronics.',
    tier: 2,
    active: true,
    icon: 'build',
  });
  await saveBadge({
    id: 'demo-badge-courier',
    name: 'Reliable Courier',
    description: 'Completed 50 localized deliveries on time.',
    tier: 1,
    active: true,
    icon: 'local_shipping',
  });

  await grantReward({
    id: 'demo-grant-1',
    recipient_id: 'demo-sarah-jenkins',
    recipient_name: 'Sarah Jenkins',
    reward_type: 'Eco-Points (500)',
    reason: 'Milestone: 50 items shared',
    awarded_by: 'System Auto',
    created_at: now - 30 * DAY,
  });
  await grantReward({
    id: 'demo-grant-2',
    recipient_id: 'demo-david-chen',
    recipient_name: 'David Chen',
    reward_type: 'Verified Pro Badge',
    reason: 'Manual grant for exceptional repair workshop',
    awarded_by: 'Puran Haat Admin',
    created_at: now - 32 * DAY,
  });
}
